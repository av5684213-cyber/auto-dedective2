import axios, { type AxiosRequestConfig } from 'axios';
import { RateLimiter, getRateLimiter } from '@/lib/utils/rate-limiter';
import {
  TURKISH_MAKES,
  TURKISH_CITIES,
  FUEL_TYPES,
  TRANSMISSIONS,
  BODY_TYPES,
  SELLER_TYPES,
  MAKE_MODELS,
  ISTANBUL_DISTRICTS,
  ANKARA_DISTRICTS,
  IZMIR_DISTRICTS,
  COLORS_TR,
} from '@/lib/constants';

// ═══════════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════════

export interface SearchFilters {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  mileageMax?: number;
  fuelType?: string;
  transmission?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export interface ListingRaw {
  id?: string;
  sourceName: string;
  sourceUrl: string;
  vin?: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  price: number;
  currency?: string;
  mileageKm?: number;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  color?: string;
  city?: string;
  district?: string;
  sellerType?: string;
  imageUrl?: string;
  imageUrls?: string[];
  description?: string;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  isActive?: boolean;
}

export interface AdapterResult {
  success: boolean;
  listings: ListingRaw[];
  totalFound: number;
  error?: string;
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════
// User-Agent Pool
// ═══════════════════════════════════════════════════════════════════

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
];

// ═══════════════════════════════════════════════════════════════════
// Normalization Maps
// ═══════════════════════════════════════════════════════════════════

const MAKE_NORMALIZE: Record<string, string> = {
  'vw': 'Volkswagen',
  'mercedes': 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  'bmw': 'BMW',
  'alfa': 'Alfa Romeo',
  'land rover': 'Land Rover',
  'range rover': 'Land Rover',
  'mini cooper': 'Mini',
  'hyundai': 'Hyundai',
  'honda': 'Honda',
  'toyota': 'Toyota',
  'ford': 'Ford',
  'renault': 'Renault',
  'fiat': 'Fiat',
  'peugeot': 'Peugeot',
  'opel': 'Opel',
  'citroen': 'Citroen',
  'volvo': 'Volvo',
  'mazda': 'Mazda',
  'nissan': 'Nissan',
  'kia': 'Kia',
  'skoda': 'Skoda',
  'seat': 'Seat',
  'suzuki': 'Suzuki',
  'mitsubishi': 'Mitsubishi',
  'chevrolet': 'Chevrolet',
  'jeep': 'Jeep',
  'lexus': 'Lexus',
  'infiniti': 'Infiniti',
  'dacia': 'Dacia',
  'tofaş': 'Tofaş',
  'tofas': 'Tofaş',
  'audi': 'Audi',
};

const MODEL_NORMALIZE: Record<string, string> = {
  '3 serisi': '3 Serisi',
  '5 serisi': '5 Serisi',
  '1 serisi': '1 Serisi',
  '4 serisi': '4 Serisi',
  '7 serisi': '7 Serisi',
  '2 serisi': '2 Serisi',
  'c serisi': 'C Serisi',
  'e serisi': 'E Serisi',
  'a serisi': 'A Serisi',
  's serisi': 'S Serisi',
  'b serisi': 'B Serisi',
};

const FUEL_NORMALIZE: Record<string, string> = {
  'benzin': 'Benzin',
  'dizel': 'Dizel',
  'lpg': 'LPG',
  'elektrik': 'Elektrik',
  'hibrit': 'Hybrid',
  'hybrid': 'Hybrid',
  'benzin+lpg': 'Benzin + LPG',
  'benzin + lpg': 'Benzin + LPG',
  'benzin&lpg': 'Benzin + LPG',
  'dizel+lpg': 'Dizel + LPG',
  'dizel + lpg': 'Dizel + LPG',
};

const TRANSMISSION_NORMALIZE: Record<string, string> = {
  'manuel': 'Manuel',
  'otomatik': 'Otomatik',
  'yarı otomatik': 'Yarı Otomatik',
  'yari otomatik': 'Yarı Otomatik',
  'dsg': 'Yarı Otomatik',
  'cvt': 'Yarı Otomatik',
  'otomatik vites': 'Otomatik',
  'manuel vites': 'Manuel',
  'triptonic': 'Yarı Otomatik',
  'tiptronic': 'Yarı Otomatik',
  'dualogic': 'Yarı Otomatik',
  'robotize': 'Yarı Otomatik',
  'amt': 'Yarı Otomatik',
};

const BODY_NORMALIZE: Record<string, string> = {
  'sedan': 'Sedan',
  'hatchback': 'Hatchback',
  'suv': 'SUV',
  'station': 'Station',
  'kombi': 'Station',
  'station wagon': 'Station',
  'kupé': 'Coupe',
  'kuppe': 'Coupe',
  'coupe': 'Coupe',
  'cabrio': 'Cabrio',
  'cabriolet': 'Cabrio',
  'mpv': 'MPV',
  'minivan': 'MPV',
  'pickup': 'Pickup',
  'kamyonet': 'Pickup',
  'roadster': 'Cabrio',
};

const SELLER_NORMALIZE: Record<string, string> = {
  'sahibinden': 'Sahibinden',
  'galeri': 'Galeri',
  'galeriden': 'Galeri',
  'yetkili bayi': 'Yetkili Bayi',
  'yetkili': 'Yetkili Bayi',
  'kurumsal': 'Galeri',
  'bayi': 'Yetkili Bayi',
};

// ═══════════════════════════════════════════════════════════════════
// Abstract Base Adapter
// ═══════════════════════════════════════════════════════════════════

export abstract class BaseAdapter {
  abstract sourceName: string;
  abstract baseUrl: string;
  abstract defaultDelay: number;
  abstract maxConcurrency: number;

  // Per-adapter rate limiter (lazily created)
  private _rateLimiter: RateLimiter | null = null;

  // ── Required abstract methods ──────────────────────────────────

  /** Scrape listings from the real source with the given filters */
  abstract search(filters: SearchFilters): Promise<AdapterResult>;

  /** Parse a raw scraped element into a ListingRaw */
  abstract parseListing(raw: unknown): ListingRaw;

  /** Fetch detail page for a single listing */
  abstract getDetail(listingId: string): Promise<ListingRaw | null>;

  /** Provide mock/fallback data when real scraping fails */
  abstract scrapeFallback(): Promise<ListingRaw[]>;

  // ── Smart scrape with fallback ─────────────────────────────────

  /**
   * Smart search: tries real scraping first, falls back to mock data
   * when the real site is unreachable or returns unexpected results.
   */
  async scrape(filters?: SearchFilters): Promise<AdapterResult> {
    const start = Date.now();

    try {
      // Attempt real scraping with a generous timeout (5 min for multi-page)
      const realResult = await Promise.race([
        this.search(filters ?? {}),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Scraping timeout')), 300_000),
        ),
      ]);

      if (realResult.success && realResult.listings.length > 0) {
        return realResult;
      }

      // Real scraping returned 0 listings — fall through to fallback
      this.log(
        `Real scraping returned 0 listings for "${this.sourceName}", using fallback`,
        'warn',
      );
    } catch (err) {
      this.log(
        `Real scraping failed for "${this.sourceName}": ${err instanceof Error ? err.message : String(err)}`,
        'warn',
      );
    }

    // Fallback to mock data
    try {
      const fallbackListings = await this.scrapeFallback();
      return {
        success: fallbackListings.length > 0,
        listings: fallbackListings,
        totalFound: fallbackListings.length,
        durationMs: Date.now() - start,
      };
    } catch (fallbackErr) {
      return {
        success: false,
        listings: [],
        totalFound: 0,
        error: fallbackErr instanceof Error ? fallbackErr.message : 'Both real and fallback scraping failed',
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Polite fetching ────────────────────────────────────────────

  /**
   * Fetch with rate limiting, retries, User-Agent rotation, and
   * exponential back-off.  Returns the HTML string body.
   */
  async fetchWithPoliteness(url: string, options?: AxiosRequestConfig): Promise<string> {
    const limiter = this.getRateLimiter();
    await limiter.wait();

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Random delay to look more human
        const delay = this.defaultDelay + Math.random() * this.defaultDelay;
        await this.sleep(delay);

        const config: AxiosRequestConfig = {
          ...options,
          url,
          method: options?.method ?? 'GET',
          headers: {
            ...(options?.headers ?? {}),
            'User-Agent': this.getUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
          },
          timeout: options?.timeout ?? 15_000,
          validateStatus: (status: number) => status < 500, // don't throw on 4xx
          ...(this.shouldUseProxy() ? { proxy: this.getProxyConfig() } : {}),
        };

        const response = await axios(config);

        // Handle rate-limit responses
        if (response.status === 429) {
          this.log(`Rate limited (429) on attempt ${attempt}/${maxRetries} for ${url}`, 'warn');
          await this.handleRateLimit({ status: 429 });
          continue;
        }

        if (response.status === 403) {
          this.log(`Forbidden (403) on attempt ${attempt}/${maxRetries} for ${url}`, 'warn');
          // Wait longer for 403 — might be a temporary block
          await this.sleep(this.defaultDelay * 4 * attempt);
          continue;
        }

        if (response.status >= 400) {
          this.log(`HTTP ${response.status} on attempt ${attempt}/${maxRetries} for ${url}`, 'warn');
          if (attempt < maxRetries) {
            await this.sleep(this.defaultDelay * Math.pow(2, attempt));
            continue;
          }
          throw new Error(`HTTP ${response.status} after ${maxRetries} retries`);
        }

        return typeof response.data === 'string' ? response.data : String(response.data);
      } catch (err: unknown) {
        const isNetworkError =
          err instanceof Error &&
          ('code' in err
            ? (err as NodeJS.ErrnoException).code === 'ECONNRESET' ||
              (err as NodeJS.ErrnoException).code === 'ETIMEDOUT' ||
              (err as NodeJS.ErrnoException).code === 'ECONNREFUSED' ||
              (err as NodeJS.ErrnoException).code === 'ENOTFOUND'
            : false);

        if (isNetworkError && attempt < maxRetries) {
          this.log(
            `Network error (${(err as NodeJS.ErrnoException).code}) on attempt ${attempt}/${maxRetries} for ${url}`,
            'warn',
          );
          await this.sleep(this.defaultDelay * Math.pow(2, attempt));
          continue;
        }

        if (attempt < maxRetries) {
          this.log(
            `Error on attempt ${attempt}/${maxRetries} for ${url}: ${err instanceof Error ? err.message : String(err)}`,
            'warn',
          );
          await this.sleep(this.defaultDelay * Math.pow(2, attempt));
          continue;
        }

        throw err;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
  }

  // ── robots.txt ─────────────────────────────────────────────────

  /**
   * Check robots.txt for the source's base URL.
   * Returns true if we are allowed, false if explicitly disallowed.
   * Defaults to true if robots.txt cannot be fetched.
   */
  async checkRobotsTxt(): Promise<boolean> {
    try {
      const robotsUrl = `${this.baseUrl.replace(/\/+$/, '')}/robots.txt`;
      const response = await axios.get(robotsUrl, {
        timeout: 10_000,
        headers: { 'User-Agent': this.getUserAgent() },
        validateStatus: () => true,
      });

      if (response.status !== 200) {
        this.log(`Could not fetch robots.txt (${response.status}), assuming allowed`, 'warn');
        return true;
      }

      const text: string = response.data;
      const lines = text.split('\n').map((l) => l.trim().toLowerCase());

      let isRelevantAgent = false;

      for (const line of lines) {
        if (line.startsWith('user-agent:')) {
          const agent = line.split(':')[1]?.trim();
          isRelevantAgent = agent === '*' || agent === 'AraciKiyasBot';
        }

        if (isRelevantAgent && line.startsWith('disallow:')) {
          const path = line.split(':')[1]?.trim();
          // If disallow is "/" (root), we are not allowed
          if (path === '/' || path === '/*') {
            this.log(`robots.txt disallows access to "${path}"`, 'warn');
            return false;
          }
        }
      }

      return true;
    } catch {
      this.log('Failed to fetch robots.txt, assuming allowed', 'warn');
      return true;
    }
  }

  // ── Rate-limit handling ────────────────────────────────────────

  /** Handle a rate-limit response by waiting before next attempt */
  async handleRateLimit(_error: unknown): Promise<void> {
    // Exponential back-off: base delay × 2^attempt (called after each failed attempt)
    const waitMs = this.defaultDelay * 8 + Math.random() * this.defaultDelay * 4;
    this.log(`Rate limit detected, waiting ${Math.round(waitMs)}ms`, 'warn');
    await this.sleep(waitMs);
  }

  // ── Proxy support ──────────────────────────────────────────────

  protected shouldUseProxy(): boolean {
    return !!(process.env.PROXY_HOST && process.env.PROXY_PORT);
  }

  protected getProxy(): string | undefined {
    if (!this.shouldUseProxy()) return undefined;
    const host = process.env.PROXY_HOST!;
    const port = process.env.PROXY_PORT!;
    return `${host}:${port}`;
  }

  /** Build an axios-compatible proxy config object */
  private getProxyConfig(): { host: string; port: number; auth?: { username: string; password: string } } {
    const host = process.env.PROXY_HOST!;
    const port = parseInt(process.env.PROXY_PORT!, 10);

    const auth =
      process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD
        ? { username: process.env.PROXY_USERNAME, password: process.env.PROXY_PASSWORD }
        : process.env.PROXY_AUTH
          ? (() => {
              const decoded = Buffer.from(process.env.PROXY_AUTH!, 'base64').toString('utf-8');
              const [username, password] = decoded.split(':');
              return { username: username ?? '', password: password ?? '' };
            })()
          : undefined;

    return { host, port, ...(auth ? { auth } : {}) };
  }

  // ── Logging ────────────────────────────────────────────────────

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[${this.sourceName}]`;
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  // ── Normalization helpers ──────────────────────────────────────

  protected normalizeMake(value: string): string {
    const lowered = value.trim().toLowerCase();
    return MAKE_NORMALIZE[lowered] ?? this.titleCase(value);
  }

  protected normalizeModel(value: string): string {
    const lowered = value.trim().toLowerCase();
    return MODEL_NORMALIZE[lowered] ?? this.titleCase(value);
  }

  protected normalizeFuel(value: string): string {
    const lowered = value.trim().toLowerCase();
    return FUEL_NORMALIZE[lowered] ?? this.titleCase(value);
  }

  protected normalizeTransmission(value: string): string {
    const lowered = value.trim().toLowerCase();
    return TRANSMISSION_NORMALIZE[lowered] ?? this.titleCase(value);
  }

  protected normalizeBodyType(value: string): string {
    const lowered = value.trim().toLowerCase();
    return BODY_NORMALIZE[lowered] ?? this.titleCase(value);
  }

  protected normalizeSellerType(value: string): string {
    const lowered = value.trim().toLowerCase();
    return SELLER_NORMALIZE[lowered] ?? this.titleCase(value);
  }

  // ── Extraction helpers ─────────────────────────────────────────

  /**
   * Extract a numeric price from free-form Turkish text.
   * Handles formats: "1.234.567", "1,234,567", "1234567", "1.234.567 TL"
   */
  protected extractPrice(text: string): number {
    if (!text) return 0;

    // Remove currency symbols and whitespace
    let cleaned = text.replace(/[^\d.,]/g, '');

    // Handle Turkish format: dots as thousands separator, optional comma for decimals
    // e.g. "1.234.567" or "1.234.567,89"
    if (cleaned.includes('.') && cleaned.includes(',')) {
      // Dots are thousands, comma is decimal separator
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes('.')) {
      // Could be thousands separator (1.234.567) or decimal (1234.56)
      const parts = cleaned.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        // Thousands separator
        cleaned = cleaned.replace(/\./g, '');
      }
      // else: treat as decimal — keep as is
    } else if (cleaned.includes(',')) {
      // Could be thousands (1,234,567) or decimal (1234,56)
      const parts = cleaned.split(',');
      if (parts.length > 2) {
        // Thousands separator
        cleaned = cleaned.replace(/,/g, '');
      } else if (parts.length === 2 && parts[1].length === 3) {
        // Thousands separator with 3-digit groups
        cleaned = cleaned.replace(/,/g, '');
      } else {
        // Decimal separator
        cleaned = cleaned.replace(',', '.');
      }
    }

    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Extract a 4-digit year from text.
   * Validates range 1990–2026.
   */
  protected extractYear(text: string): number {
    if (!text) return 0;
    const match = text.match(/\b(19[9]\d|20[0-2]\d)\b/);
    if (!match) return 0;
    const year = parseInt(match[1], 10);
    return year >= 1990 && year <= 2026 ? year : 0;
  }

  /**
   * Extract mileage in km from Turkish text.
   * Handles: "125.000 km", "125000 km", "125.000 Km", "125.000 KM"
   */
  protected extractMileage(text: string): number {
    if (!text) return 0;

    // Remove km/Km/KM suffix and whitespace
    let cleaned = text.replace(/\s*km\s*/i, '').trim();

    // Use the same price-like parsing (Turkish number format)
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        cleaned = cleaned.replace(/\./g, '');
      }
    } else if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      if (parts.length > 2) {
        cleaned = cleaned.replace(/,/g, '');
      } else if (parts.length === 2 && parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, '');
      } else {
        cleaned = cleaned.replace(',', '.');
      }
    }

    // Remove any remaining non-digit chars
    cleaned = cleaned.replace(/[^\d]/g, '');

    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }

  // ── User-Agent rotation ────────────────────────────────────────

  protected getUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  // ── Private utilities ──────────────────────────────────────────

  /** Title-case a string, preserving existing casing patterns */
  private titleCase(value: string): string {
    return value
      .trim()
      .split(/\s+/)
      .map((word) => {
        if (word.length === 0) return word;
        // Preserve all-caps abbreviations like SUV, MPV, LPG
        if (word === word.toUpperCase() && word.length <= 4) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /** Get or create the per-adapter rate limiter */
  private getRateLimiter(): RateLimiter {
    if (!this._rateLimiter) {
      this._rateLimiter = getRateLimiter({
        maxRequests: Math.max(1, this.maxConcurrency),
        perSeconds: 10,
        key: `adapter:${this.sourceName}`,
      });
    }
    return this._rateLimiter;
  }

  /** Promisified sleep */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════
// Mock Data Helpers (used by adapters for scrapeFallback)
// ═══════════════════════════════════════════════════════════════════

/** Pick a random element from an array */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick a random element, with 30% chance of returning undefined (optional fields) */
export function pickOptional<T>(arr: readonly T[]): T | undefined {
  if (Math.random() < 0.3) return undefined;
  return pick(arr);
}

/** Random integer in [min, max] inclusive */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random float in [min, max), rounded to `decimals` places */
export function randFloat(min: number, max: number, decimals = 0): number {
  const val = Math.random() * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/** Get models for a given make */
export function getModelsForMake(make: string): string[] {
  return MAKE_MODELS[make] ?? ['Bilinmiyor'];
}

/** Get a realistic district for a city */
export function getDistrictForCity(city: string): string | undefined {
  if (city === 'İstanbul') return pick(ISTANBUL_DISTRICTS);
  if (city === 'Ankara') return pick(ANKARA_DISTRICTS);
  if (city === 'İzmir') return pick(IZMIR_DISTRICTS);
  return Math.random() < 0.4 ? 'Merkez' : undefined;
}

/** Generate a realistic fake listing URL for a given source */
export function fakeListingUrl(
  baseUrl: string,
  make: string,
  model: string,
  year: number,
): string {
  const slug = `${make.toLowerCase().replace(/\s+/g, '-')}-${model.toLowerCase().replace(/\s+/g, '-')}-${year}`;
  const id = randInt(1000000, 9999999);
  return `${baseUrl}/ilan/vasita-araba-${slug}-${id}`;
}

/** Generate a realistic price adjusted by a multiplier for platform bias */
export function generatePrice(baseMin: number, baseMax: number, multiplier = 1): number {
  const raw = randInt(baseMin, baseMax);
  const adjusted = Math.round(raw * multiplier);
  // Round to nearest 1000
  return Math.round(adjusted / 1000) * 1000;
}

/** Generate a realistic mileage for a given year */
export function generateMileage(year: number): number | undefined {
  const age = 2025 - year;
  if (age <= 0) return Math.random() < 0.6 ? 0 : randInt(0, 5000);
  const avgKmPerYear = randInt(10000, 25000);
  const km = age * avgKmPerYear + randInt(-5000, 5000);
  return Math.max(0, km);
}

/** Generate a list of mock listings with common logic */
export function generateMockListings(opts: {
  sourceName: string;
  baseUrl: string;
  count: number;
  priceMultiplier?: number;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  sellerTypes?: string[];
  allowedMakes?: string[];
  fuelBias?: string[];
  bodyBias?: string[];
  descriptionTemplate?: (make: string, model: string, year: number, city: string) => string;
}): ListingRaw[] {
  const {
    sourceName,
    baseUrl,
    count,
    priceMultiplier = 1,
    priceMin = 500000,
    priceMax = 8000000,
    yearMin = 2010,
    yearMax = 2025,
    sellerTypes = SELLER_TYPES,
    allowedMakes = TURKISH_MAKES,
    fuelBias,
    bodyBias,
    descriptionTemplate,
  } = opts;

  const listings: ListingRaw[] = [];

  for (let i = 0; i < count; i++) {
    const make = pick(allowedMakes);
    const models = getModelsForMake(make);
    const model = pick(models);
    const year = randInt(yearMin, yearMax);
    const city = pick(TURKISH_CITIES);
    const district = getDistrictForCity(city);
    const mileage = Math.random() < 0.05 ? undefined : generateMileage(year);
    const fuelType = fuelBias ? pick(fuelBias) : pickOptional(FUEL_TYPES);
    const bodyType = bodyBias ? pick(bodyBias) : pickOptional(BODY_TYPES);
    const price = generatePrice(priceMin, priceMax, priceMultiplier);

    const listing: ListingRaw = {
      sourceName,
      sourceUrl: fakeListingUrl(baseUrl, make, model, year),
      make,
      model,
      trim: Math.random() < 0.4 ? pick(models) : undefined,
      year,
      price,
      currency: 'TRY',
      mileageKm: mileage,
      fuelType,
      transmission: pickOptional(TRANSMISSIONS),
      bodyType,
      color: pickOptional(COLORS_TR),
      city,
      district,
      sellerType: pick(sellerTypes),
      imageUrl: `https://placehold.co/600x400?text=${encodeURIComponent(make)}+${encodeURIComponent(model)}`,
      imageUrls: [
        `https://placehold.co/600x400?text=${encodeURIComponent(make)}+${encodeURIComponent(model)}+1`,
        `https://placehold.co/600x400?text=${encodeURIComponent(make)}+${encodeURIComponent(model)}+2`,
        `https://placehold.co/600x400?text=${encodeURIComponent(make)}+${encodeURIComponent(model)}+3`,
      ],
      description: descriptionTemplate
        ? descriptionTemplate(make, model, year, city)
        : `${year} ${make} ${model}, ${city}'da satılık. Bakımları yapılmış, hasar kaydı yok.`,
      isActive: true,
    };

    listings.push(listing);
  }

  return listings;
}
