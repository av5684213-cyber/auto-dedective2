import { BaseAdapter, type SearchFilters, type AdapterResult, type ListingRaw } from './base';
import { RateLimiter, getRateLimiter } from '@/lib/utils/rate-limiter';
import { TURKISH_MAKES, MAKE_MODELS } from '@/lib/constants';
import * as cheerio from 'cheerio';

// ═══════════════════════════════════════════════════════════════════
// Otokoç.com.tr Adapter — Real scraping with graceful fallback
// ═══════════════════════════════════════════════════════════════════

/** Known makes sorted by length (longest first) for greedy matching in titles */
const MAKES_BY_LENGTH = [...TURKISH_MAKES].sort((a, b) => b.length - a.length);

export class OtokocAdapter extends BaseAdapter {
  sourceName = 'otokoc';
  baseUrl = 'https://www.otokoc.com.tr';
  defaultDelay = 2500;
  maxConcurrency = 3;

  private rateLimiter: RateLimiter;

  constructor() {
    super();
    this.rateLimiter = getRateLimiter({
      maxRequests: 15,
      perSeconds: 60, // 15 requests per minute
      key: 'otokoc',
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
      const url = `${this.baseUrl}/ikinci-el-araba/${listingId}`;
      this.log(`Fetching detail: ${url}`);

      await this.rateLimiter.wait();
      const html = await this.fetchWithPoliteness(url);
      const $ = cheerio.load(html);

      // Title
      const title = $('h1, .vehicle-title, .detail-title, .car-title').first().text().trim();
      const { make, model } = this.extractMakeModelFromTitle(title);

      // Price
      const priceText = $('.price, .vehicle-price, .detail-price, .car-price').first().text().trim();

      // Detail specifications from the page
      const details: Record<string, string> = {};
      $('.spec-list li, .detail-features li, .vehicle-specs li, .features-item, .specs-table tr').each((_, el) => {
        const key = $(el).find('.label, .spec-label, strong, th').text().trim().toLowerCase();
        const value = $(el).find('.value, .spec-value, span, td').last().text().trim();
        if (key && value) {
          details[key] = value;
        }
      });

      // Description
      const description = $('.description, .vehicle-description, .detail-description, #description').text().trim();

      // Images
      const imageUrls: string[] = [];
      $('.gallery img, .vehicle-photos img, .detail-images img, .carousel img, .slider img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
        if (src) imageUrls.push(src);
      });

      // Map detail keys to fields
      const year = this.extractYear(details['yıl'] || details['model yılı'] || details['yil'] || '');
      const mileage = this.extractMileage(details['kilometre'] || details['km'] || '');
      const fuelType = details['yakıt tipi'] || details['yakıt'] || details['yakit tipi'] || '';
      const transmission = details['vites'] || details['vites tipi'] || '';
      const bodyType = details['kasa tipi'] || '';
      const color = details['renk'] || '';
      const city = details['il'] || details['şehir'] || details['sehir'] || '';
      const district = details['ilçe'] || details['ilce'] || '';

      const listing: ListingRaw = {
        id: listingId,
        sourceName: this.sourceName,
        sourceUrl: `${this.baseUrl}/ikinci-el-araba/${listingId}`,
        make: this.normalizeMake(make || details['marka'] || ''),
        model: this.normalizeModel(model || details['seri'] || details['model'] || ''),
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
        sellerType: 'Yetkili Bayi', // Otokoç is a major dealer network (Koç Holding)
        imageUrl: imageUrls[0] || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        description: description || undefined,
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
   * Build the Otokoç search URL from filter parameters.
   * Maps our internal filter names to Otokoç's query parameter names.
   */
  private buildSearchUrl(filters: SearchFilters): string {
    const params = new URLSearchParams();

    // Base path for second-hand cars
    let path = '/ikinci-el-araba';

    // Make and model as path segments
    if (filters.make) {
      const makeSlug = this.slugify(filters.make);
      path += `/${makeSlug}`;

      if (filters.model) {
        const modelSlug = this.slugify(filters.model);
        path += `/${modelSlug}`;
      }
    }

    // Year range
    if (filters.yearMin) {
      params.set('minYil', String(filters.yearMin));
    }
    if (filters.yearMax) {
      params.set('maxYil', String(filters.yearMax));
    }

    // Price range
    if (filters.priceMin) {
      params.set('minFiyat', String(filters.priceMin));
    }
    if (filters.priceMax) {
      params.set('maxFiyat', String(filters.priceMax));
    }

    // Fuel type — Otokoç uses "yakitTipi"
    if (filters.fuelType) {
      params.set('yakitTipi', this.slugify(filters.fuelType));
    }

    // Transmission — Otokoç uses "vitesTipi"
    if (filters.transmission) {
      params.set('vitesTipi', this.slugify(filters.transmission));
    }

    // Pagination
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    if (page > 1) {
      params.set('sayfa', String(page));
    }

    const queryString = params.toString();
    return `${this.baseUrl}${path}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Parse search result HTML and extract listing cards.
   * Tries multiple CSS selector strategies since site structure may change.
   */
  private parseSearchResults(html: string): ListingRaw[] {
    const $ = cheerio.load(html);
    const listings: ListingRaw[] = [];

    // Try multiple selectors for listing cards
    const cardSelectors = [
      '.car-card',
      '.vehicle-item',
      '.listing-card',
      '.product-card',
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
   * Uses multiple fallback selectors for each field.
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
      $el.find('.title, .card-title, .vehicle-title, h2, h3').first().text().trim();

    // ── Price ────────────────────────────────────────────────────
    const priceText =
      $el.find('.price, .vehicle-price, .card-price, .listing-price').first().text().trim();

    // ── Year ─────────────────────────────────────────────────────
    const yearText =
      $el.find('.year, .model-year, .card-year, [data-year]').first().text().trim();

    // ── Mileage ──────────────────────────────────────────────────
    const kmText =
      $el.find('.km, .mileage, .card-km, [data-km]').first().text().trim();

    // ── Fuel type ────────────────────────────────────────────────
    const fuelText =
      $el.find('.fuel, .fuel-type, .card-fuel, [data-fuel]').first().text().trim();

    // ── Transmission ─────────────────────────────────────────────
    const transText =
      $el.find('.transmission, .gear, .card-transmission, [data-transmission]').first().text().trim();

    // ── City / Location ──────────────────────────────────────────
    const cityText =
      $el.find('.city, .location, .card-city, [data-city]').first().text().trim();

    // ── Image ────────────────────────────────────────────────────
    const imgEl = $el.find('img').first();
    const imageUrl =
      imgEl.attr('src') ||
      imgEl.attr('data-src') ||
      imgEl.attr('data-lazy-src') ||
      imgEl.attr('data-original') ||
      undefined;

    // ── Seller type hint ─────────────────────────────────────────
    const sellerHint = $el.find('.seller, .seller-type, .store, .dealer').first().text().trim();

    // ── Build ListingRaw ─────────────────────────────────────────
    const { make, model } = this.extractMakeModelFromTitle(title);
    const year = this.extractYear(yearText) || this.extractYear(title);
    const price = this.extractPrice(priceText);
    const mileage = this.extractMileage(kmText);

    let sellerType: string | undefined;
    if (sellerHint) {
      sellerType = this.normalizeSellerType(sellerHint);
    } else {
      // Otokoç is a major dealer network — primarily Yetkili Bayi
      sellerType = 'Yetkili Bayi';
    }

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
      sellerType,
      imageUrl,
      isActive: true,
    };

    return listing;
  }

  /**
   * Extract the listing ID from an Otokoç URL.
   * Otokoç URLs may contain a numeric ID segment at the end.
   */
  private extractIdFromUrl(url: string): string | undefined {
    const match = url.match(/\/(\d+)(?:\/|\?|$)/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract make and model from a listing title string.
   * Tries to match known Turkish makes against the title (case-insensitive).
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

  /**
   * Slugify a string for use in Otokoç URL paths.
   * Lowercase, replace Turkish characters, strip non-alphanumeric.
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
