import { BaseAdapter, type SearchFilters, type AdapterResult, type ListingRaw } from './base';

// ═══════════════════════════════════════════════════════════════════
// Sahibinden.com Adapter — DISABLED BY DEFAULT (ENABLE_SAHIBINDEN=false)
// ═══════════════════════════════════════════════════════════════════
//
// STATUS: ❌ Disabled — no legal access path
//
// Sahibinden.com:
//   - Has NO public/developer API
//   - Has NO licensed feed or partner program (public)
//   - robots.txt disallows all paths except / and /sitemap
//   - Terms of Service §3.2 forbids automated access (bots, scrapers)
//   - Terms of Service §3.5 forbids database scraping
//   - Terms of Service §6.1 forbids copying site content
//   - Protected by Cloudflare WAF + bot detection
//
// Adapter ships as a SKELETON ONLY. search() returns empty.
// Deep-link model: UI provides "kaynağa git" link to sahibinden.com search.

const ENABLED = process.env.ENABLE_SAHIBINDEN === 'true';

export class SahibindenAdapter extends BaseAdapter {
  sourceName = 'sahibinden';
  baseUrl = 'https://www.sahibinden.com';
  defaultDelay = 3000;
  maxConcurrency = 1;

  /**
   * Build a deep-link URL to sahibinden.com search results.
   *
   * Example output:
   *   https://www.sahibinden.com/otomobil?searchText=BMW+320i&city=istanbul
   */
  buildDeepLink(filters: SearchFilters): string {
    const params = new URLSearchParams();
    if (filters.make) {
      const q = [filters.make, filters.model].filter(Boolean).join(' ');
      if (q) params.set('searchText', q);
    }
    if (filters.city) params.set('city', filters.city);
    if (filters.yearMin) params.set('aMinYear', String(filters.yearMin));
    if (filters.yearMax) params.set('aMaxYear', String(filters.yearMax));
    if (filters.priceMin) params.set('aMinPrice', String(filters.priceMin));
    if (filters.priceMax) params.set('aMaxPrice', String(filters.priceMax));

    const qs = params.toString();
    return qs
      ? `${this.baseUrl}/otomobil?${qs}`
      : `${this.baseUrl}/otomobil`;
  }

  async search(_filters: SearchFilters): Promise<AdapterResult> {
    if (!ENABLED) {
      return {
        success: false,
        listings: [],
        totalFound: 0,
        durationMs: 0,
        error: 'Sahibinden adapter is disabled (ENABLE_SAHIBINDEN=false). See docs/sahibinden-access.md.',
      };
    }

    const apiKey = process.env.SAHIBINDEN_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        listings: [],
        totalFound: 0,
        durationMs: 0,
        error: 'ENABLE_SAHIBINDEN=true but SAHIBINDEN_API_KEY not set. No legal API available.',
      };
    }

    return {
      success: false,
      listings: [],
      totalFound: 0,
      durationMs: 0,
      error: 'Sahibinden API integration not yet implemented (no official API available).',
    };
  }

  parseListing(_raw: unknown): ListingRaw {
    return {} as ListingRaw;
  }

  async getDetail(_listingId: string): Promise<ListingRaw | null> {
    return null;
  }

  async scrapeFallback(): Promise<ListingRaw[]> {
    return [];
  }
}
