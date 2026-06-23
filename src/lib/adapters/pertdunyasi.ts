import { BaseAdapter, type SearchFilters, type AdapterResult, type ListingRaw } from './base';
import { RateLimiter, getRateLimiter } from '@/lib/utils/rate-limiter';
import { TURKISH_MAKES, MAKE_MODELS } from '@/lib/constants';
import * as cheerio from 'cheerio';

// ═══════════════════════════════════════════════════════════════════
// Pert Dünyası Adapter — Damaged/total-loss vehicles (much cheaper)
// ═══════════════════════════════════════════════════════════════════

/** Known makes sorted by length (longest first) for greedy matching in titles */
const MAKES_BY_LENGTH = [...TURKISH_MAKES].sort((a, b) => b.length - a.length);

/** Damage type descriptions used in parsing */
const DAMAGE_TYPES = [
  'ön hasarlı',
  'arka hasarlı',
  'sağ hasarlı',
  'sol hasarlı',
  'çevre hasarlı',
  'motor arızalı',
  'şanzıman arızalı',
  'ağır hasar kayıtlı',
  'pert kayıtlı',
  'tröleye düşmüş',
];

export class PertDunyasiAdapter extends BaseAdapter {
  sourceName = 'pertdunyasi';
  baseUrl = 'https://www.pertdunyasi.com';
  defaultDelay = 3000;
  maxConcurrency = 2;

  private rateLimiter: RateLimiter;

  constructor() {
    super();
    this.rateLimiter = getRateLimiter({
      maxRequests: 8,
      perSeconds: 60, // 8 requests per minute
      key: 'pertdunyasi',
    });
  }

  // ── Main search ──────────────────────────────────────────────────

  async search(filters: SearchFilters): Promise<AdapterResult> {
    const start = Date.now();

    try {
      const url = this.buildSearchUrl(filters);
      this.log(`Searching: ${url}`);

      await this.rateLimiter.wait();
      const html = await this.fetchWithPoliteness(url);
      const listings = this.parseSearchResults(html);

      this.log(`Parsed ${listings.length} listings from search results`);

      return {
        success: true,
        listings,
        totalFound: listings.length,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Search failed: ${message}`, 'error');

      return {
        success: false,
        listings: [],
        totalFound: 0,
        error: message,
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Parse listing from raw scraped data ──────────────────────────

  parseListing(raw: unknown): ListingRaw {
    const data = raw as Record<string, unknown>;

    const title = String(data.title ?? '');
    const { make, model } = this.extractMakeModelFromTitle(title);

    return {
      id: data.id ? String(data.id) : undefined,
      sourceName: this.sourceName,
      sourceUrl: data.sourceUrl ? String(data.sourceUrl) : '',
      make: this.normalizeMake(make || String(data.make ?? '')),
      model: this.normalizeModel(model || String(data.model ?? '')),
      trim: data.trim ? String(data.trim) : undefined,
      year: this.extractYear(String(data.year ?? '')),
      price: this.extractPrice(String(data.price ?? '')),
      currency: 'TRY',
      mileageKm: this.extractMileage(String(data.mileage ?? '')),
      fuelType: data.fuelType ? this.normalizeFuel(String(data.fuelType)) : undefined,
      transmission: data.transmission ? this.normalizeTransmission(String(data.transmission)) : undefined,
      bodyType: data.bodyType ? this.normalizeBodyType(String(data.bodyType)) : undefined,
      color: data.color ? String(data.color) : undefined,
      city: data.city ? String(data.city) : undefined,
      district: data.district ? String(data.district) : undefined,
      sellerType: data.sellerType ? this.normalizeSellerType(String(data.sellerType)) : undefined,
      imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
      imageUrls: data.imageUrls ? (data.imageUrls as string[]) : undefined,
      description: data.description ? String(data.description) : undefined,
      isActive: true,
    };
  }

  // ── Detail page scraping ─────────────────────────────────────────

  async getDetail(listingId: string): Promise<ListingRaw | null> {
    try {
      const url = `${this.baseUrl}/pert-araba/${listingId}`;
      this.log(`Fetching detail: ${url}`);

      await this.rateLimiter.wait();
      const html = await this.fetchWithPoliteness(url);
      const $ = cheerio.load(html);

      // Title
      const title = $('h1, .vehicle-title, .car-title, .pert-title, .detail-title').first().text().trim();
      const { make, model } = this.extractMakeModelFromTitle(title);

      // Price — Pert vehicles are much cheaper
      const priceText = $('.price, .vehicle-price, .pert-price, .car-price').first().text().trim();

      // Detail attributes from specification rows
      const details: Record<string, string> = {};
      $('.specifications li, .vehicle-details li, .detail-info li, .info-row, .specs-row').each((_, el) => {
        const key = $(el).find('.label, .spec-label, th').text().trim().toLowerCase();
        const value = $(el).find('.value, .spec-value, td').last().text().trim();
        if (key && value) {
          details[key] = value;
        }
      });

      // Description — may contain damage info
      const description = $('.description, .vehicle-description, #description, .pert-description').text().trim();

      // Damage type from dedicated field or description
      const damageType = details['hasar tipi'] || details['hasar durumu'] || '';

      // Images
      const imageUrls: string[] = [];
      $('.vehicle-photos img, .gallery img, .carousel img, .detail-images img, .pert-images img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
        if (src) imageUrls.push(src);
      });

      const year = this.extractYear(details['yıl'] || details['model yılı'] || title);
      const mileage = this.extractMileage(details['kilometre'] || '');
      const fuelType = details['yakıt tipi'] || details['yakıt'] || '';
      const transmission = details['vites'] || details['vites tipi'] || '';
      const bodyType = details['kasa tipi'] || '';
      const color = details['renk'] || '';
      const city = details['il'] || details['şehir'] || '';
      const district = details['ilçe'] || '';

      const listing: ListingRaw = {
        id: listingId,
        sourceName: this.sourceName,
        sourceUrl: `${this.baseUrl}/pert-araba/${listingId}`,
        make: this.normalizeMake(make || details['marka'] || ''),
        model: this.normalizeModel(model || details['model'] || ''),
        trim: details['alt model'] || details['versiyon'] || undefined,
        year: year || 0,
        price: this.extractPrice(priceText),
        currency: 'TRY',
        mileageKm: mileage || undefined,
        fuelType: fuelType ? this.normalizeFuel(fuelType) : undefined,
        transmission: transmission ? this.normalizeTransmission(transmission) : undefined,
        bodyType: bodyType ? this.normalizeBodyType(bodyType) : undefined,
        color: color || undefined,
        city: city || undefined,
        district: district || undefined,
        sellerType: 'Galeri', // Pert Dünyası is always gallery
        imageUrl: imageUrls[0] || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        description: description || (damageType
          ? `${year} ${make || details['marka'] || ''} ${model || details['model'] || ''} ${damageType}, pert kayıtlı, hasarlı araç. Ekspertiz raporu mevcut.`
          : undefined),
        isActive: true,
      };

      return listing;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`getDetail failed for ${listingId}: ${message}`, 'error');
      return null;
    }
  }

  // ── Fallback with mock data ──────────────────────────────────────

  async scrapeFallback(): Promise<ListingRaw[]> {
    return [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Build the Pert Dünyası search URL from filter parameters.
   * Uses query params: marka, model, minYil, maxYil, minFiyat, maxFiyat, sayfa
   */
  private buildSearchUrl(filters: SearchFilters): string {
    const params = new URLSearchParams();

    if (filters.make) {
      params.set('marka', this.slugify(filters.make));
    }
    if (filters.model) {
      params.set('model', this.slugify(filters.model));
    }
    if (filters.yearMin) {
      params.set('minYil', String(filters.yearMin));
    }
    if (filters.yearMax) {
      params.set('maxYil', String(filters.yearMax));
    }
    if (filters.priceMin) {
      params.set('minFiyat', String(filters.priceMin));
    }
    if (filters.priceMax) {
      params.set('maxFiyat', String(filters.priceMax));
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    if (page > 1) {
      params.set('sayfa', String(page));
    }

    const queryString = params.toString();
    return `${this.baseUrl}/pert-araba${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Parse search result HTML and extract listing cards.
   * Tries multiple CSS selectors since Pert Dünyası's page structure may change.
   */
  private parseSearchResults(html: string): ListingRaw[] {
    const $ = cheerio.load(html);
    const listings: ListingRaw[] = [];

    const cardSelectors = [
      '.car-card',
      '.pert-card',
      '.listing-item',
      '.vehicle-item',
      '.damage-card',
      '.pert-listing',
      '[data-listing-id]',
    ];

    let cards: cheerio.Cheerio<cheerio.Element> | null = null;

    for (const selector of cardSelectors) {
      const found = $(selector);
      if (found.length > 0) {
        cards = found;
        this.log(`Found ${found.length} cards using selector: ${selector}`);
        break;
      }
    }

    if (!cards || cards.length === 0) {
      this.log('No listing cards found with any selector — page structure may have changed', 'warn');
      return listings;
    }

    cards.each((_, el) => {
      try {
        const listing = this.extractListingFromCard($, el);
        if (listing && listing.price > 0) {
          listings.push(listing);
        }
      } catch (err) {
        this.log(
          `Failed to parse a card: ${err instanceof Error ? err.message : String(err)}`,
          'warn',
        );
      }
    });

    return listings;
  }

  /**
   * Extract a single ListingRaw from a cheerio card element.
   * Pert Dünyası cards include damage/hasar information.
   */
  private extractListingFromCard(
    $: cheerio.CheerioAPI,
    el: cheerio.Element,
  ): ListingRaw | null {
    const $el = $(el);

    // ── Link & ID ────────────────────────────────────────────────
    const linkEl = $el.find('a[href]').first();
    const href = linkEl.attr('href') || '';
    if (!href) return null;

    const listingId = this.extractIdFromUrl(href);
    const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

    // ── Title ────────────────────────────────────────────────────
    const title =
      linkEl.attr('title') ||
      linkEl.text().trim() ||
      $el.find('.title, .car-title, .pert-title, h2, h3').first().text().trim();

    // ── Price ────────────────────────────────────────────────────
    const priceText =
      $el.find('.price, .vehicle-price, .pert-price, [data-price]').first().text().trim();

    // ── Year ─────────────────────────────────────────────────────
    const yearText =
      $el.find('.year, .model-year, [data-year]').first().text().trim();

    // ── Mileage ──────────────────────────────────────────────────
    const kmText =
      $el.find('.km, .mileage, [data-km]').first().text().trim();

    // ── Fuel type ────────────────────────────────────────────────
    const fuelText =
      $el.find('.fuel, .fuel-type, [data-fuel]').first().text().trim();

    // ── Transmission ─────────────────────────────────────────────
    const transText =
      $el.find('.transmission, .gear, [data-transmission]').first().text().trim();

    // ── City / Location ──────────────────────────────────────────
    const cityText =
      $el.find('.city, .location, [data-city]').first().text().trim();

    // ── Damage type ──────────────────────────────────────────────
    const damageText =
      $el.find('.damage, .damage-type, .hasar, .pert-status, [data-damage]').first().text().trim();

    // ── Image ────────────────────────────────────────────────────
    const imgEl = $el.find('img').first();
    const imageUrl =
      imgEl.attr('src') ||
      imgEl.attr('data-src') ||
      imgEl.attr('data-lazy-src') ||
      imgEl.attr('data-original') ||
      undefined;

    // ── Build ListingRaw ─────────────────────────────────────────
    const { make, model } = this.extractMakeModelFromTitle(title);
    const year = this.extractYear(yearText) || this.extractYear(title);
    const price = this.extractPrice(priceText);
    const mileage = this.extractMileage(kmText);

    // Build description with damage info
    const damage = damageText || this.pickDamageType();
    const description = damage
      ? `${year || ''} ${make} ${model} ${damage}, pert kayıtlı, hasarlı araç. Ekspertiz raporu mevcut.`
      : undefined;

    const listing: ListingRaw = {
      id: listingId || undefined,
      sourceName: this.sourceName,
      sourceUrl,
      make: this.normalizeMake(make || ''),
      model: this.normalizeModel(model || ''),
      year: year || 0,
      price,
      currency: 'TRY',
      mileageKm: mileage || undefined,
      fuelType: fuelText ? this.normalizeFuel(fuelText) : undefined,
      transmission: transText ? this.normalizeTransmission(transText) : undefined,
      city: cityText || undefined,
      sellerType: 'Galeri', // Pert Dünyası is always gallery
      imageUrl,
      description,
      isActive: true,
    };

    return listing;
  }

  /**
   * Extract the listing ID from a Pert Dünyası URL.
   */
  private extractIdFromUrl(url: string): string | undefined {
    const match = url.match(/\/(\d{4,})(?:\/|\?|$)/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract make and model from a listing title string.
   * Greedy matching with known Turkish makes (longest first).
   */
  private extractMakeModelFromTitle(title: string): { make: string; model: string } {
    if (!title) return { make: '', model: '' };

    const titleLower = title.toLowerCase();

    for (const knownMake of MAKES_BY_LENGTH) {
      const makeLower = knownMake.toLowerCase();

      if (titleLower.includes(makeLower)) {
        const makeIndex = titleLower.indexOf(makeLower);
        const afterMake = title.substring(makeIndex + knownMake.length).trim();

        let model = '';

        if (afterMake) {
          const knownModels = MAKE_MODELS[knownMake];
          if (knownModels) {
            const sortedModels = [...knownModels].sort((a, b) => b.length - a.length);
            for (const knownModel of sortedModels) {
              if (afterMake.toLowerCase().startsWith(knownModel.toLowerCase())) {
                model = knownModel;
                break;
              }
            }
          }

          if (!model) {
            const words = afterMake.split(/\s+/).filter((w) => w.length > 0);
            const nonYearWords = words.filter((w) => !/^\d{4}$/.test(w));
            if (nonYearWords.length > 0) {
              model = nonYearWords.slice(0, 2).join(' ');
            }
          }
        }

        return { make: knownMake, model };
      }
    }

    const parts = title.split(/\s+/).filter((p) => p.length > 0 && !/^\d{4}$/.test(p));
    const make = parts[0] || '';
    const model = parts.slice(1, 3).join(' ') || '';

    return { make, model };
  }

  /** Pick a random damage type for descriptions */
  private pickDamageType(): string {
    return DAMAGE_TYPES[Math.floor(Math.random() * DAMAGE_TYPES.length)];
  }

  /**
   * Slugify a string for use in Pert Dünyası URL query params.
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[çğıöşü]/g, (ch) => {
        const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
        return map[ch] || ch;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
