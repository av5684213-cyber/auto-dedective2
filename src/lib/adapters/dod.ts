import { BaseAdapter, type SearchFilters, type AdapterResult, type ListingRaw } from './base';

// ═══════════════════════════════════════════════════════════════════
// DOD.com.tr Adapter — DISABLED (Cloudflare-protected, no legal path)
// ═══════════════════════════════════════════════════════════════════
//
// STATUS: ❌ Blocked — Cloudflare bot protection
//
// DOD.com.tr:
//   - All HTTP requests return 403 with Cloudflare challenge
//   - sitemap.xml is also Cloudflare-protected (cannot enumerate URLs)
//   - No public/developer API
//   - No licensed feed or partner program (public)
//   - Terms of Service forbid automated access
//
// Adapter ships as a SKELETON ONLY. search() and scrapeFallback()
// return empty results. NO scraping code.
//
// Deep-link model: UI provides "kaynağa git" link to DOD search results.

const ENABLED = process.env.ENABLE_DOD === 'true';

export class DodAdapter extends BaseAdapter {
  sourceName = 'dod';
  baseUrl = 'https://www.dod.com.tr';
  defaultDelay = 3000;
  maxConcurrency = 1;

  /**
   * Build a deep-link URL to DOD search results.
   *
   * DOD URL pattern (best-effort guess based on common Turkish auto
   * site conventions; DOD's actual URL structure is hidden behind
   * Cloudflare and not publicly documented):
   *   https://www.dod.com.tr/ikinci-el-arac?q=<make>+<model>&yil_min=X&yil_max=Y&fiyat_min=X&fiyat_max=Y&sehir=<city>&yakit=<fuel>&vites=<transmission>
   */
  buildDeepLink(filters: SearchFilters): string {
    const params = new URLSearchParams();

    if (filters.make) {
      const q = [filters.make, filters.model].filter(Boolean).join(' ');
      if (q) params.set('q', q);
    }
    if (filters.yearMin) params.set('yil_min', String(filters.yearMin));
    if (filters.yearMax) params.set('yil_max', String(filters.yearMax));
    if (filters.priceMin) params.set('fiyat_min', String(filters.priceMin));
    if (filters.priceMax) params.set('fiyat_max', String(filters.priceMax));
    if (filters.city) params.set('sehir', filters.city);
    if (filters.fuelType) params.set('yakit', filters.fuelType);
    if (filters.transmission) params.set('vites', filters.transmission);

    const qs = params.toString();
    return qs
      ? `${this.baseUrl}/ikinci-el-arac?${qs}`
      : `${this.baseUrl}/ikinci-el-arac`;
  }

  async search(_filters: SearchFilters): Promise<AdapterResult> {
    if (!ENABLED) {
      return {
        success: false,
        listings: [],
        totalFound: 0,
        durationMs: 0,
        error: 'DOD adapter is disabled (ENABLE_DOD=false). Cloudflare-protected, no legal access path. Use buildDeepLink() for kaynağa git link.',
      };
    }

    const apiKey = process.env.DOD_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        listings: [],
        totalFound: 0,
        durationMs: 0,
        error: 'ENABLE_DOD=true but DOD_API_KEY not set. No legal API available.',
      };
    }

    return {
      success: false,
      listings: [],
      totalFound: 0,
      durationMs: 0,
      error: 'DOD API integration not yet implemented (no official API available).',
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
