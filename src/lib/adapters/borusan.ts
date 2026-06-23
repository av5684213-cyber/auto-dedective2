import { BaseAdapter, type SearchFilters, type AdapterResult, type ListingRaw } from './base';

// ═══════════════════════════════════════════════════════════════════
// Borusan Next Adapter — DISABLED (Cloudflare-protected)
// ═══════════════════════════════════════════════════════════════════
//
// STATUS: ❌ Blocked — Cloudflare bot protection (403 on all requests)
//
// borusannext.com:
//   - All HTTP requests return 403 Cloudflare challenge
//   - sitemap.xml also blocked
//   - No public API
//
// Adapter ships as skeleton with deep-link model only.

const ENABLED = process.env.ENABLE_BORUSAN === 'true';

export class BorusanAdapter extends BaseAdapter {
  sourceName = 'borusan';
  baseUrl = 'https://www.borusannext.com';
  defaultDelay = 3000;
  maxConcurrency = 1;

  buildDeepLink(filters: SearchFilters): string {
    const params = new URLSearchParams();
    if (filters.make) {
      const q = [filters.make, filters.model].filter(Boolean).join(' ');
      if (q) params.set('q', q);
    }
    if (filters.yearMin) params.set('minYear', String(filters.yearMin));
    if (filters.yearMax) params.set('maxYear', String(filters.yearMax));
    if (filters.priceMin) params.set('minPrice', String(filters.priceMin));
    if (filters.priceMax) params.set('maxPrice', String(filters.priceMax));

    const qs = params.toString();
    return qs ? `${this.baseUrl}/ikinci-el-arac?${qs}` : `${this.baseUrl}/ikinci-el-arac`;
  }

  async search(_filters: SearchFilters): Promise<AdapterResult> {
    return {
      success: false,
      listings: [],
      totalFound: 0,
      durationMs: 0,
      error: 'Borusan Next is Cloudflare-protected (403). Use buildDeepLink() for kaynağa git link.',
    };
  }

  parseListing(_raw: unknown): ListingRaw { return {} as ListingRaw; }
  async getDetail(_listingId: string): Promise<ListingRaw | null> { return null; }
  async scrapeFallback(): Promise<ListingRaw[]> { return []; }
}
