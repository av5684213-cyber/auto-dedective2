import { RawListing, ScrapeResult } from '@/lib/types';
import { BaseAdapter, type ListingRaw, type AdapterResult, type SearchFilters } from './base';
import { LetgoAdapter } from './letgo';

// ── Re-exports ────────────────────────────────────────────────────────
export { BaseAdapter } from './base';
export type { ListingRaw, AdapterResult, SearchFilters } from './base';
export { LetgoAdapter } from './letgo';

// ── Only adapters that can provide REAL data ──────────────────────────
// Sites that are accessible and return parseable HTML:
//   - Letgo: ✅ 200 OK, cheerio-parseable, real car listings
//
// Sites blocked (403/bot protection) — removed:
//   - Sahibinden, Arabam, Otokoç, DOD, Spoticar, Avis
//
// Sites that need Playwright (SPA/JS-render) — removed for now:
//   - VavaCars, Sixt, Pert Dünyası
//
// Sites unreachable (DNS/SSL) — removed:
//   - Carvak, Hasarlı Araba, Taşıt.com
//
// Sites with no car listing page found — removed:
//   - Garenta (rental only, no second-hand sales page)

export const ALL_ADAPTERS: BaseAdapter[] = [
  new LetgoAdapter(),
];

/** Map of adapter name → instance */
export const ADAPTER_MAP: Record<string, BaseAdapter> = Object.fromEntries(
  ALL_ADAPTERS.map((a) => [a.sourceName, a]),
);

/**
 * Convert ListingRaw (new adapter interface) to RawListing (legacy DB type).
 */
function listingRawToRaw(listing: ListingRaw): RawListing {
  return {
    sourceName: listing.sourceName,
    sourceUrl: listing.sourceUrl,
    vin: listing.vin,
    make: listing.make,
    model: listing.model,
    trim: listing.trim,
    year: listing.year,
    price: listing.price,
    currency: listing.currency ?? 'TRY',
    mileageKm: listing.mileageKm,
    fuelType: listing.fuelType,
    transmission: listing.transmission,
    bodyType: listing.bodyType,
    color: listing.color,
    city: listing.city,
    district: listing.district,
    sellerType: listing.sellerType,
    imageUrl: listing.imageUrl,
    imageUrls: listing.imageUrls,
    description: listing.description,
  };
}

/**
 * Run all adapters with optional search filters.
 * Only returns REAL data — no mock/fallback.
 */
export async function runAllAdapters(filters?: SearchFilters): Promise<{
  listings: RawListing[];
  results: ScrapeResult[];
}> {
  const allListings: RawListing[] = [];
  const results: ScrapeResult[] = [];

  // Run adapters sequentially to be polite
  for (const adapter of ALL_ADAPTERS) {
    const start = Date.now();
    try {
      const adapterResult: AdapterResult = await adapter.scrape(filters);
      const durationMs = Date.now() - start;
      const rawListings = adapterResult.listings.map(listingRawToRaw);
      allListings.push(...rawListings);
      results.push({
        sourceName: adapter.sourceName,
        itemsFound: adapterResult.totalFound,
        itemsSaved: rawListings.length,
        durationMs,
        status: adapterResult.success ? 'success' : 'failed',
        errorMsg: adapterResult.error,
      });
    } catch (error) {
      const durationMs = Date.now() - start;
      results.push({
        sourceName: adapter.sourceName,
        itemsFound: 0,
        itemsSaved: 0,
        durationMs,
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { listings: allListings, results };
}

/**
 * Run a single adapter by source name.
 */
export async function runAdapter(
  sourceName: string,
  filters?: SearchFilters,
): Promise<{ listings: RawListing[]; result: ScrapeResult }> {
  const adapter = ADAPTER_MAP[sourceName];
  if (!adapter) {
    throw new Error(`Unknown adapter: ${sourceName}`);
  }

  const start = Date.now();
  try {
    const adapterResult: AdapterResult = await adapter.scrape(filters);
    const durationMs = Date.now() - start;
    const rawListings = adapterResult.listings.map(listingRawToRaw);
    return {
      listings: rawListings,
      result: {
        sourceName: adapter.sourceName,
        itemsFound: adapterResult.totalFound,
        itemsSaved: rawListings.length,
        durationMs,
        status: adapterResult.success ? 'success' : 'failed',
        errorMsg: adapterResult.error,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    return {
      listings: [],
      result: {
        sourceName: adapter.sourceName,
        itemsFound: 0,
        itemsSaved: 0,
        durationMs,
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
