// Otodedektif - Intercity2.com API Scraper
//
// Intercity2.com has a public API (no Cloudflare, no Playwright needed):
//   - Search: GET /api/search/?sayfa=N&siralama=akilli
//   - Detail: GET /api/detail/?no={listing_no}
//
// Returns JSON with marka, model, model_yili, tahmini_satis_fiyati,
// yakit_turu, sanziman, km, bolge, resim, etc.

import axios, { type AxiosRequestConfig } from 'axios';
import type { ListingRaw } from '@/lib/adapters/base';

const BASE_URL = 'https://intercity2.com';
const USER_AGENT = 'OtodedektifBot/1.0 (+https://otodedektif.vercel.app)';
const HTTP_TIMEOUT = 15_000;
const MAX_PARALLEL = 8;

const FUEL_MAP: Record<string, string> = {
  'Bel': 'Benzin', 'Benzin': 'Benzin', 'Dizel': 'Dizel',
  'LPG': 'Benzin + LPG', 'Elektrik': 'Elektrik', 'Hibrit': 'Hybrid',
};

function makeConfig(): AxiosRequestConfig {
  return {
    timeout: HTTP_TIMEOUT,
    headers: {
      'User-Agent': USER_AGENT,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json',
      'Referer': `${BASE_URL}/`,
    },
  };
}

function parsePrice(s: string): number {
  const n = parseInt((s || '0').replace(/[^0-9]/g, ''), 10);
  return n > 10000 ? n : 0;
}

function parseYear(s: string): number {
  const n = parseInt((s || '0').replace(/[^0-9]/g, ''), 10);
  return (n >= 1990 && n <= 2030) ? n : 0;
}

function parseKm(s: string): number | undefined {
  const n = parseInt((s || '0').replace(/[^0-9]/g, ''), 10);
  return (n > 0 && n < 1_000_000) ? n : undefined;
}

export async function bulkScrapeIntercity2(maxListings: number = 200): Promise<{
  listings: ListingRaw[];
  totalIds: number;
}> {
  console.log(`[intercity2] bulkScrape: max=${maxListings}`);

  // Step 1: Get all listing IDs from search API
  const allNos: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= 20; page++) {
    try {
      const url = `${BASE_URL}/api/search/?sayfa=${page}&siralama=akilli`;
      const res = await axios.get(url, makeConfig());
      const results = res.data?.results || [];
      if (results.length === 0) break;

      for (const r of results) {
        const no = String(r.no || '');
        if (no && !seen.has(no)) {
          seen.add(no);
          allNos.push(no);
        }
      }
      console.log(`[intercity2] Page ${page}: ${results.length} items (total: ${allNos.length})`);
    } catch (err) {
      console.warn(`[intercity2] Page ${page} failed:`, (err as Error).message);
      break;
    }
  }

  console.log(`[intercity2] Total unique IDs: ${allNos.length}`);

  // Step 2: Fetch details in parallel
  const toFetch = allNos.slice(0, maxListings);
  const listings: ListingRaw[] = [];
  const queue = [...toFetch];

  const workers: Promise<void>[] = [];
  for (let w = 0; w < MAX_PARALLEL; w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const no = queue.shift();
        if (!no) break;

        try {
          const res = await axios.get(`${BASE_URL}/api/detail/?no=${no}`, makeConfig());
          const d = res.data;
          if (!d || !d.marka) continue;

          const price = parsePrice(String(d.tahmini_satis_fiyati || ''));
          const year = parseYear(String(d.model_yili || ''));
          if (!price || !year) continue;

          const make = String(d.marka || '').replace(/\b\w/g, c => c.toUpperCase());
          const model = String(d.model_filtre || d.model || '').replace(/\b\w/g, c => c.toUpperCase());
          const fuel = FUEL_MAP[String(d.yakit_turu || '')] || null;
          const transmission = String(d.sanziman || '') || null;
          const km = parseKm(String(d.km || ''));
          const city = String(d.bolge || '').toLowerCase() || null;

          let img = String(d.resim || '');
          if (img && !img.startsWith('http')) img = `${BASE_URL}/${img.replace(/^\//, '')}`;

          listings.push({
            sourceName: 'intercity2',
            sourceUrl: `${BASE_URL}/arac/${no}`,
            vin: d.sasi_no || undefined,
            make, model, trim: undefined,
            year, price, currency: 'TRY',
            mileageKm: km, fuelType: fuel || undefined,
            transmission: transmission || undefined,
            bodyType: undefined, color: String(d.renk || '').toLowerCase() || undefined,
            city, district: undefined,
            sellerType: 'Galeri',
            imageUrl: img || undefined,
            imageUrls: img ? [img] : [],
            description: String(d.ek_bilgiler || '') || undefined,
          });
        } catch (err) {
          // Continue on error
        }
      }
    })());
  }
  await Promise.all(workers);

  console.log(`[intercity2] Valid listings: ${listings.length}`);
  return { listings, totalIds: allNos.length };
}
