import { BaseAdapter, type SearchFilters, type AdapterResult, type ListingRaw } from './base';
import { RateLimiter, getRateLimiter } from '@/lib/utils/rate-limiter';
import { TURKISH_MAKES, MAKE_MODELS } from '@/lib/constants';
import * as cheerio from 'cheerio';

// ═══════════════════════════════════════════════════════════════════
// VavaCars.com Adapter — Real scraping with graceful fallback
// Premium inspected car platform — may use heavy JS rendering
// ═══════════════════════════════════════════════════════════════════

/** Fuel type mapping: Turkish name → VavaCars query param value */
const FUEL_TYPE_PARAMS: Record<string, string> = {
  'Benzin': 'benzin',
  'Dizel': 'dizel',
  'LPG': 'lpg',
  'Elektrik': 'elektrik',
  'Hybrid': 'hybrid',
  'Benzin + LPG': 'benzin-lpg',
};

/** Transmission mapping: Turkish name → VavaCars query param value */
const TRANSMISSION_PARAMS: Record<string, string> = {
  'Manuel': 'manuel',
  'Otomatik': 'otomatik',
  'Yarı Otomatik': 'yari-otomatik',
};

/** Known makes sorted by length (longest first) for greedy matching in titles */
const MAKES_BY_LENGTH = [...TURKISH_MAKES].sort((a, b) => b.length - a.length);

export class VavaCarsAdapter extends BaseAdapter {
  sourceName = 'vavacars';
  baseUrl = 'https://www.vavacars.com';
  defaultDelay = 2500;
  maxConcurrency = 2;

  private rateLimiter: RateLimiter;

  constructor() {
    super();
    this.rateLimiter = getRateLimiter({
      maxRequests: 12,
      perSeconds: 60, // 12 requests per minute
      key: 'vavacars',
    });
  }

  // ── Main search ──────────────────────────────────────────────────

  async search(filters: SearchFilters): Promise<AdapterResult> {
    const start = Date.now();

    try {
      // Build the search URL from filters
      const url = this.buildSearchUrl(filters);
      this.log(`Searching: ${url}`);

      // Respect rate limits
      await this.rateLimiter.wait();

      // Fetch the page HTML
      const html = await this.fetchWithPoliteness(url);

      // Parse listings from the HTML
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
      // VavaCars URLs use /araba/ or /car/ for detail pages
      const url = `${this.baseUrl}/araba/${listingId}`;
      this.log(`Fetching detail: ${url}`);

      await this.rateLimiter.wait();
      const html = await this.fetchWithPoliteness(url);
      const $ = cheerio.load(html);

      // Title
      const title = $('h1').first().text().trim() || $('.car-detail-title, .ad-detail-title').first().text().trim();
      const { make, model } = this.extractMakeModelFromTitle(title);

      // Price
      const priceText = $('.price, .car-price').first().text().trim();

      // Spec table rows (key-value pairs)
      const details: Record<string, string> = {};
      $('.spec-table tr, .detail-table tr, .properties tr').each((_, el) => {
        const cells = $(el).find('td, th');
        if (cells.length >= 2) {
          const key = cells.first().text().trim().toLowerCase();
          const value = cells.last().text().trim();
          if (key && value) {
            details[key] = value;
          }
        }
      });

      // Also try dl/dt/dd pattern
      $('dl dt').each((_, el) => {
        const key = $(el).text().trim().toLowerCase();
        const value = $(el).next('dd').text().trim();
        if (key && value) {
          details[key] = value;
        }
      });

      // Description
      const description = $('.description, .ad-description, .car-description').first().text().trim();

      // Images
      const imageUrls: string[] = [];
      $('.gallery img, .ad-images img, .car-images img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src) imageUrls.push(src);
      });

      // Map detail keys to fields (Turkish → English)
      const year = this.extractYear(details['yıl'] || details['model yılı'] || '');
      const mileage = this.extractMileage(details['kilometre'] || '');
      const fuelType = details['yakıt tipi'] || details['yakıt'] || '';
      const transmission = details['vites'] || details['vites tipi'] || '';
      const bodyType = details['kasa tipi'] || '';
      const color = details['renk'] || '';
      const city = details['il'] || details['şehir'] || details['konum'] || '';
      const district = details['ilçe'] || '';
      const sellerType = details['satıcı'] || details['sahibi'] || '';

      const listing: ListingRaw = {
        id: listingId,
        sourceName: this.sourceName,
        sourceUrl: `${this.baseUrl}/araba/${listingId}`,
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
        sellerType: sellerType ? this.normalizeSellerType(sellerType) : undefined,
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
   * Build the VavaCars search URL from filter parameters.
   * Maps our internal filter names to VavaCars's query parameter names.
   */
  private buildSearchUrl(filters: SearchFilters): string {
    const params = new URLSearchParams();

    // Base path
    const path = '/tr/ikinci-el-araba';

    // Brand (make)
    if (filters.make) {
      params.set('brand', this.slugify(filters.make));

      // Model
      if (filters.model) {
        params.set('model', this.slugify(filters.model));
      }
    }

    // Year range
    if (filters.yearMin) {
      params.set('minYear', String(filters.yearMin));
    }
    if (filters.yearMax) {
      params.set('maxYear', String(filters.yearMax));
    }

    // Price range
    if (filters.priceMin) {
      params.set('minPrice', String(filters.priceMin));
    }
    if (filters.priceMax) {
      params.set('maxPrice', String(filters.priceMax));
    }

    // Fuel type
    if (filters.fuelType) {
      const fuelParam = FUEL_TYPE_PARAMS[filters.fuelType];
      if (fuelParam) {
        params.set('fuelType', fuelParam);
      }
    }

    // Transmission
    if (filters.transmission) {
      const transParam = TRANSMISSION_PARAMS[filters.transmission];
      if (transParam) {
        params.set('transmission', transParam);
      }
    }

    // Pagination
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    if (page > 1) {
      params.set('page', String(page));
    }

    const queryString = params.toString();
    return `${this.baseUrl}${path}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Parse search result HTML and extract listing cards.
   * Tries multiple CSS selector strategies since site structure may change.
   * Note: VavaCars may rely heavily on JS rendering, so cheerio may
   * not find much — that's fine, fallback will kick in.
   */
  private parseSearchResults(html: string): ListingRaw[] {
    const $ = cheerio.load(html);
    const listings: ListingRaw[] = [];

    // Try multiple selectors for listing cards
    const cardSelectors = [
      '.car-card',
      '.vehicle-card',
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
      this.log('No listing cards found with any selector — page structure may have changed or JS-rendered', 'warn');
      return listings;
    }

    cards.each((_, el) => {
      try {
        const listing = this.extractListingFromCard($, el);
        if (listing && listing.price > 0) {
          listings.push(listing);
        }
      } catch (err) {
        // Skip individual cards that fail to parse
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
    // VavaCars uses /araba/ or /car/ in listing URLs
    const linkEl = $el.find('a[href*="/araba/"], a[href*="/car/"]').first();
    const href = linkEl.attr('href') || '';
    if (!href) return null; // No link = not a valid listing

    const listingId = this.extractIdFromUrl(href);
    const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

    // ── Title ────────────────────────────────────────────────────
    const title =
      linkEl.attr('title') ||
      linkEl.text().trim() ||
      $el.find('.title, .car-title, h3').first().text().trim();

    // ── Price ────────────────────────────────────────────────────
    const priceText =
      $el.find('.price, .car-price').first().text().trim();

    // ── Specs (km, fuel, trans combined) ─────────────────────────
    const specsText =
      $el.find('.specs, .car-specs').first().text().trim();

    // Parse individual specs from the combined text
    const yearText = this.extractYearFromSpecs(specsText) ||
      $el.find('.year, .model-year, [data-year]').first().text().trim();
    const kmText = this.extractKmFromSpecs(specsText) ||
      $el.find('.km, .mileage, [data-km]').first().text().trim();
    const fuelText = this.extractFuelFromSpecs(specsText) ||
      $el.find('.fuel, .fuel-type, [data-fuel]').first().text().trim();
    const transText = this.extractTransFromSpecs(specsText) ||
      $el.find('.transmission, .gear, [data-transmission]').first().text().trim();

    // ── City / Location ──────────────────────────────────────────
    const cityText =
      $el.find('.location, .city').first().text().trim();

    // ── Image ────────────────────────────────────────────────────
    const imgEl = $el.find('img').first();
    const imageUrl =
      imgEl.attr('src') ||
      imgEl.attr('data-src') ||
      imgEl.attr('data-lazy-src') ||
      imgEl.attr('data-original') ||
      undefined;

    // ── Seller type hint ─────────────────────────────────────────
    const sellerHint = $el.find('.store, .seller-type, .dealer-badge').first().text().trim();

    // ── Build ListingRaw ─────────────────────────────────────────
    const { make, model } = this.extractMakeModelFromTitle(title);
    const year = this.extractYear(yearText) || this.extractYear(title);
    const price = this.extractPrice(priceText);
    const mileage = this.extractMileage(kmText);

    // VavaCars is mostly professional sellers
    let sellerType: string | undefined;
    if (sellerHint) {
      sellerType = this.normalizeSellerType(sellerHint);
    } else {
      // Default to Galeri for VavaCars since it's a premium platform
      sellerType = 'Galeri';
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
   * Extract the listing ID from a VavaCars URL.
   * VavaCars URLs use /araba/ or /car/ followed by a slug with an ID.
   * Pattern: /araba/NNNNNN-slug or /car/slug-NNNNNN
   */
  private extractIdFromUrl(url: string): string | undefined {
    // Match /araba/ or /car/ followed by an ID
    const match = url.match(/\/(?:araba|car)\/(?:.*-)?(\d+)(?:\/|$|\?)/);
    if (match) return match[1];

    // Fallback: match any long numeric ID in the path
    const numericMatch = url.match(/\/(?:araba|car)\/.*?(\d{4,})/);
    return numericMatch ? numericMatch[1] : undefined;
  }

  /**
   * Extract year from a combined specs string.
   * VavaCars often shows specs like "2020 | 45.000 km | Dizel | Otomatik"
   */
  private extractYearFromSpecs(specs: string): string {
    if (!specs) return '';
    const match = specs.match(/\b(19[9]\d|20[0-2]\d)\b/);
    return match ? match[1] : '';
  }

  /**
   * Extract mileage from a combined specs string.
   * Looks for patterns like "45.000 km" or "45.000 Km"
   */
  private extractKmFromSpecs(specs: string): string {
    if (!specs) return '';
    const match = specs.match(/([\d.,]+)\s*km/i);
    return match ? match[1] + ' km' : '';
  }

  /**
   * Extract fuel type from a combined specs string.
   * Looks for known Turkish fuel type names.
   */
  private extractFuelFromSpecs(specs: string): string {
    if (!specs) return '';
    const fuelNames = ['Benzin', 'Dizel', 'LPG', 'Elektrik', 'Hibrit', 'Hybrid', 'Benzin + LPG'];
    const specsLower = specs.toLowerCase();
    for (const fuel of fuelNames) {
      if (specsLower.includes(fuel.toLowerCase())) {
        return fuel;
      }
    }
    return '';
  }

  /**
   * Extract transmission from a combined specs string.
   * Looks for known Turkish transmission names.
   */
  private extractTransFromSpecs(specs: string): string {
    if (!specs) return '';
    const specsLower = specs.toLowerCase();
    if (specsLower.includes('otomatik')) return 'Otomatik';
    if (specsLower.includes('manuel')) return 'Manuel';
    if (specsLower.includes('yarı otomatik') || specsLower.includes('yari otomatik')) return 'Yarı Otomatik';
    return '';
  }

  /**
   * Extract make and model from a listing title string.
   * Tries to match known Turkish makes against the title (case-insensitive).
   * Uses greedy matching (longest make name first) to avoid partial matches.
   */
  private extractMakeModelFromTitle(title: string): { make: string; model: string } {
    if (!title) return { make: '', model: '' };

    const titleLower = title.toLowerCase();

    // Try to find a known make in the title (longest match first)
    for (const knownMake of MAKES_BY_LENGTH) {
      const makeLower = knownMake.toLowerCase();

      if (titleLower.includes(makeLower)) {
        // Found the make — extract the model from the rest of the title
        const makeIndex = titleLower.indexOf(makeLower);
        const afterMake = title.substring(makeIndex + knownMake.length).trim();

        // The model is the first word(s) after the make
        let model = '';

        if (afterMake) {
          // Try to match a known model for this make
          const knownModels = MAKE_MODELS[knownMake];
          if (knownModels) {
            // Sort models by length (longest first) for greedy matching
            const sortedModels = [...knownModels].sort((a, b) => b.length - a.length);
            for (const knownModel of sortedModels) {
              if (afterMake.toLowerCase().startsWith(knownModel.toLowerCase())) {
                model = knownModel;
                break;
              }
            }
          }

          // If no known model matched, take the first meaningful word(s)
          if (!model) {
            // Take up to 2 words after the make as the model
            const words = afterMake.split(/\s+/).filter((w) => w.length > 0);
            // Skip year-like words (4-digit numbers)
            const nonYearWords = words.filter((w) => !/^\d{4}$/.test(w));
            if (nonYearWords.length > 0) {
              model = nonYearWords.slice(0, 2).join(' ');
            }
          }
        }

        return { make: knownMake, model };
      }
    }

    // Fallback: first word is make, rest is model
    const parts = title.split(/\s+/).filter((p) => p.length > 0 && !/^\d{4}$/.test(p));
    const make = parts[0] || '';
    const model = parts.slice(1, 3).join(' ') || '';

    return { make, model };
  }

  /**
   * Slugify a string for use in VavaCars URL paths.
   * Lowercase, replace spaces and special chars with hyphens, strip non-alphanumeric.
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
