import { BaseAdapter, type SearchFilters, type AdapterResult, type ListingRaw } from './base';
import { RateLimiter, getRateLimiter } from '@/lib/utils/rate-limiter';
import { TURKISH_MAKES, MAKE_MODELS } from '@/lib/constants';
import * as cheerio from 'cheerio';

// ═══════════════════════════════════════════════════════════════════
// Arabam.com Adapter — Real scraping with graceful fallback
// ═══════════════════════════════════════════════════════════════════

/** Fuel type mapping: Turkish name → Arabam query param value */
const FUEL_TYPE_PARAMS: Record<string, string> = {
  'Benzin': '1',
  'Dizel': '2',
  'LPG': '3',
  'Elektrik': '4',
  'Hybrid': '5',
};

/** Transmission mapping: Turkish name → Arabam query param value */
const TRANSMISSION_PARAMS: Record<string, string> = {
  'Manuel': '1',
  'Otomatik': '2',
};

/** Known makes sorted by length (longest first) for greedy matching in titles */
const MAKES_BY_LENGTH = [...TURKISH_MAKES].sort((a, b) => b.length - a.length);

export class ArabamAdapter extends BaseAdapter {
  sourceName = 'arabam';
  baseUrl = 'https://www.arabam.com';
  defaultDelay = 2500;
  maxConcurrency = 3;

  private rateLimiter: RateLimiter;

  constructor() {
    super();
    this.rateLimiter = getRateLimiter({
      maxRequests: 15,
      perSeconds: 60, // 15 requests per minute
      key: 'arabam',
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
      const url = `${this.baseUrl}/ilan/${listingId}`;
      this.log(`Fetching detail: ${url}`);

      await this.rateLimiter.wait();
      const html = await this.fetchWithPoliteness(url);
      const $ = cheerio.load(html);

      // Title
      const title = $('h1').first().text().trim() || $('.ad-detail-title').first().text().trim();
      const { make, model } = this.extractMakeModelFromTitle(title);

      // Price
      const priceText = $('.price, .ad-price').first().text().trim();

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
      const description = $('.description, .ad-description').first().text().trim();

      // Images
      const imageUrls: string[] = [];
      $('.gallery img, .ad-images img').each((_, el) => {
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
      const city = details['il'] || details['şehir'] || '';
      const district = details['ilçe'] || '';
      const sellerType = details['satıcı'] || details['sahibi'] || '';

      const listing: ListingRaw = {
        id: listingId,
        sourceName: this.sourceName,
        sourceUrl: `${this.baseUrl}/ilan/${listingId}`,
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
   * Build the Arabam search URL from filter parameters.
   * Maps our internal filter names to Arabam's query parameter names.
   */
  private buildSearchUrl(filters: SearchFilters): string {
    const params = new URLSearchParams();

    // Base path for second-hand cars
    let path = '/ikinci-el-araba';

    // Make (marka) and model — path segments
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

    // Fuel type
    if (filters.fuelType) {
      const fuelParam = FUEL_TYPE_PARAMS[filters.fuelType];
      if (fuelParam) {
        params.set('yakitTipi', fuelParam);
      }
    }

    // Transmission
    if (filters.transmission) {
      const transParam = TRANSMISSION_PARAMS[filters.transmission];
      if (transParam) {
        params.set('vitesTipi', transParam);
      }
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
      '.listing-item',
      '.ad-item',
      '.search-result-item',
      '.product-item',
      '.listing-row',
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
    const linkEl = $el.find('a[href*="/ilan/"]').first();
    const href = linkEl.attr('href') || '';
    if (!href) return null; // No link = not a valid listing

    const listingId = this.extractIdFromUrl(href);
    const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

    // ── Title ────────────────────────────────────────────────────
    const title =
      linkEl.attr('title') ||
      linkEl.text().trim() ||
      $el.find('.title, .ad-title, h3').first().text().trim();

    // ── Price ────────────────────────────────────────────────────
    const priceText =
      $el.find('.price, .ad-price, .listing-price').first().text().trim();

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
      $el.find('.location, .city, .ad-location').first().text().trim();

    // ── Image ────────────────────────────────────────────────────
    const imgEl = $el.find('img').first();
    const imageUrl =
      imgEl.attr('src') ||
      imgEl.attr('data-src') ||
      imgEl.attr('data-lazy-src') ||
      imgEl.attr('data-original') ||
      undefined;

    // ── Seller type hint ─────────────────────────────────────────
    const sellerHint = $el.find('.store, .seller-type, .classifiedOwner').first().text().trim();

    // ── Build ListingRaw ─────────────────────────────────────────
    const { make, model } = this.extractMakeModelFromTitle(title);
    const year = this.extractYear(yearText) || this.extractYear(title);
    const price = this.extractPrice(priceText);
    const mileage = this.extractMileage(kmText);

    // Determine seller type from hints
    let sellerType: string | undefined;
    if (sellerHint) {
      sellerType = this.normalizeSellerType(sellerHint);
    } else if (href.includes('/galeri/') || $el.find('.store-icon').length > 0) {
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
   * Extract the listing ID from an Arabam URL.
   * Arabam URLs typically contain /ilan/ followed by a slug with an ID.
   * Pattern: /ilan/.../some-slug-NNNNNN or /ilan/NNNNNN-slug
   */
  private extractIdFromUrl(url: string): string | undefined {
    // Match digits in /ilan/ path segments
    const match = url.match(/\/ilan\/(?:.*-)?(\d+)/);
    return match ? match[1] : undefined;
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
   * Slugify a string for use in Arabam URL paths.
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
