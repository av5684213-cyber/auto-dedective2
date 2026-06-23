import { RawListing, ScrapeResult } from '@/lib/types';
import { BaseAdapter, type ListingRaw, type AdapterResult, type SearchFilters } from './base';
import { LetgoAdapter } from './letgo';
import { SahibindenAdapter } from './sahibinden';
import { DodAdapter } from './dod';
import { BorusanAdapter } from './borusan';

// ── Re-exports ────────────────────────────────────────────────────────
export { BaseAdapter } from './base';
export type { ListingRaw, AdapterResult, SearchFilters } from './base';
export { LetgoAdapter } from './letgo';
export { SahibindenAdapter } from './sahibinden';
export { DodAdapter } from './dod';
export { BorusanAdapter } from './borusan';

// ── Adapter Status ────────────────────────────────────────────────────

export interface AdapterStatusEntry {
  name: string;
  displayName: string;
  status: 'active' | 'planned' | 'blocked' | 'unreachable';
  note?: string;
  deepLinkBaseUrl?: string;
}

export const ADAPTER_STATUSES: AdapterStatusEntry[] = [
  { name: 'letgo', displayName: 'Letgo', status: 'active', note: 'HTTP + cheerio, real listings scraped.' },
  { name: 'otosor', displayName: 'Otosor', status: 'active', note: 'HTTP + cheerio, /araclar sitemap scrape. No Cloudflare, robots.txt allows all bots.' },
  { name: 'intercity2', displayName: 'Intercity2', status: 'active', note: 'Public API (/api/search/ + /api/detail/). No Cloudflare, no Playwright needed.' },
  { name: 'fordikinciel', displayName: 'Fordikinciel', status: 'active', note: 'HTTP + cheerio, /araba-fiyatlari pagination. No Cloudflare.' },
  { name: 'sahibinden', displayName: 'Sahibinden.com', status: 'blocked',
    note: 'No public API; robots.txt disallows; ToS forbids scraping. Adapter ships as skeleton with deep-link support only.',
    deepLinkBaseUrl: 'https://www.sahibinden.com' },
  { name: 'arabam', displayName: 'Arabam.com', status: 'blocked',
    note: 'Cloudflare-protected. Requires Playwright worker (not yet deployed).',
    deepLinkBaseUrl: 'https://www.arabam.com' },
  { name: 'dod', displayName: 'DOD', status: 'blocked',
    note: 'Cloudflare-protected (403). No public API; no sitemap access. Adapter ships as skeleton with deep-link support only.',
    deepLinkBaseUrl: 'https://www.dod.com.tr' },
  { name: 'vavacars', displayName: 'VavaCars', status: 'unreachable',
    note: 'SPA + DNS issues outside TR. Playwright planned.',
    deepLinkBaseUrl: 'https://www.vavacars.com.tr' },
  { name: 'otokoc', displayName: 'Otokoç', status: 'blocked',
    note: 'Bot-protected. Playwright planned.',
    deepLinkBaseUrl: 'https://www.otokoc.com.tr' },
  { name: 'spoticar', displayName: 'Spoticar', status: 'blocked',
    note: 'Bot-protected.',
    deepLinkBaseUrl: 'https://www.spoticar.com.tr' },
  { name: 'garenta', displayName: 'Garenta', status: 'planned',
    note: 'Rental only, no second-hand sales page found.',
    deepLinkBaseUrl: 'https://www.garenta.com.tr' },
  { name: 'avis', displayName: 'Avis', status: 'planned',
    note: 'Rental only.',
    deepLinkBaseUrl: 'https://www.avis.com.tr' },
  { name: 'sixt', displayName: 'Sixt', status: 'planned',
    note: 'Rental only.',
    deepLinkBaseUrl: 'https://www.sixt.com.tr' },
  { name: 'pertdunyasi', displayName: 'Pert Dünyası', status: 'planned',
    note: 'SPA; Playwright planned.',
    deepLinkBaseUrl: 'https://www.pertdunyasi.com' },
  { name: 'hasarliaraba', displayName: 'Hasarlı Araba', status: 'unreachable',
    note: 'DNS unreachable.',
    deepLinkBaseUrl: 'https://www.hasarliaraba.com' },
  { name: 'carvak', displayName: 'Carvak', status: 'unreachable',
    note: 'DNS unreachable.',
    deepLinkBaseUrl: 'https://www.carvak.com.tr' },
  { name: 'tasit', displayName: 'Taşıt.com', status: 'unreachable',
    note: 'DNS unreachable.',
    deepLinkBaseUrl: 'https://www.tasit.com' },
  { name: 'borusan', displayName: 'Borusan Next', status: 'blocked',
    note: 'Cloudflare-protected (403). No public API. Adapter ships as skeleton with deep-link support only.',
    deepLinkBaseUrl: 'https://www.borusannext.com' },
];

// ── Adapter Registry ──────────────────────────────────────────────────

const ENABLE_SAHIBINDEN = process.env.ENABLE_SAHIBINDEN === 'true';
const ENABLE_DOD = process.env.ENABLE_DOD === 'true';

function buildAdapterRegistry(): BaseAdapter[] {
  const adapters: BaseAdapter[] = [new LetgoAdapter()];
  if (ENABLE_SAHIBINDEN) adapters.push(new SahibindenAdapter());
  if (ENABLE_DOD) adapters.push(new DodAdapter());
  return adapters;
}

export const ALL_ADAPTERS: BaseAdapter[] = buildAdapterRegistry();

export const ADAPTER_MAP: Record<string, BaseAdapter> = Object.fromEntries(
  ALL_ADAPTERS.map((a) => [a.sourceName, a]),
);

export function getAllAdapterStatuses(): AdapterStatusEntry[] {
  return ADAPTER_STATUSES;
}

function listingRawToRaw(listing: ListingRaw): RawListing {
  return {
    sourceName: listing.sourceName, sourceUrl: listing.sourceUrl,
    vin: listing.vin, make: listing.make, model: listing.model,
    trim: listing.trim, year: listing.year, price: listing.price,
    currency: listing.currency ?? 'TRY', mileageKm: listing.mileageKm,
    fuelType: listing.fuelType, transmission: listing.transmission,
    bodyType: listing.bodyType, color: listing.color,
    city: listing.city, district: listing.district,
    sellerType: listing.sellerType, imageUrl: listing.imageUrl,
    imageUrls: listing.imageUrls, description: listing.description,
  };
}

export async function runAllAdapters(filters?: SearchFilters): Promise<{
  listings: RawListing[]; results: ScrapeResult[];
}> {
  const allListings: RawListing[] = [];
  const results: ScrapeResult[] = [];

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
        itemsFound: 0, itemsSaved: 0, durationMs,
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { listings: allListings, results };
}

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
        itemsSaved: rawListings.length, durationMs,
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
        itemsFound: 0, itemsSaved: 0, durationMs,
        status: 'failed',
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
