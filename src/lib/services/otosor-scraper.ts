// Otodedektif - Otosor.com.tr Sitemap Scraper
//
// Otosor.com.tr is Cloudflare-free and fully accessible:
//   - /araclar?page=N returns 8 listings per page (253 pages = ~2000 listings)
//   - Listing URLs: /ilan/{make}-{model}-{trim}-{hp}hp-{transmission}-{fuel}-{year}-{id}
//   - Detail pages: price in "500.000₺" format
//   - robots.txt allows all bots
//
// Strategy:
//   1. Fetch /araclar?page=N pages to get listing URLs
//   2. Parse slug for make/model/year/fuel/transmission
//   3. Fetch detail page for price
//   4. Return ListingRaw[]

import axios, { type AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import type { ListingRaw } from '@/lib/adapters/base';
import type { SearchFilters } from '@/lib/types';

const BASE_URL = 'https://www.otosor.com.tr';
const USER_AGENT = 'OtodedektifBot/1.0 (+https://otodedektif.vercel.app)';
const HTTP_TIMEOUT = 15_000;
const MAX_PARALLEL_FETCHES = 5;
const MAX_PAGES_TO_SCAN = 10; // 10 pages × 8 listings = 80 listing URLs

// ── Known makes for slug parsing ────────────────────────────────────────

const KNOWN_MAKES = [
  'bmw', 'mercedes', 'mercedes-benz', 'audi', 'volkswagen', 'vw', 'toyota',
  'honda', 'hyundai', 'ford', 'renault', 'fiat', 'peugeot', 'opel',
  'citroen', 'volvo', 'mazda', 'nissan', 'kia', 'skoda', 'seat', 'suzuki',
  'mitsubishi', 'chevrolet', 'jeep', 'lexus', 'infiniti', 'dacia', 'tofas',
  'chery', 'alfa-romeo', 'mini', 'land-rover', 'range-rover',
];

function normalizeMake(makeRaw: string): string {
  if (!makeRaw) return '';
  const m = makeRaw.toLowerCase().trim();
  const map: Record<string, string> = {
    vw: 'Volkswagen', mercedes: 'Mercedes-Benz', 'mercedes-benz': 'Mercedes-Benz',
    bmw: 'BMW', audi: 'Audi', toyota: 'Toyota', honda: 'Honda',
    hyundai: 'Hyundai', ford: 'Ford', renault: 'Renault', fiat: 'Fiat',
    peugeot: 'Peugeot', opel: 'Opel', citroen: 'Citroen', volvo: 'Volvo',
    mazda: 'Mazda', nissan: 'Nissan', kia: 'Kia', skoda: 'Skoda',
    seat: 'Seat', suzuki: 'Suzuki', mitsubishi: 'Mitsubishi',
    chevrolet: 'Chevrolet', jeep: 'Jeep', lexus: 'Lexus',
    infiniti: 'Infiniti', dacia: 'Dacia', tofas: 'Tofaş',
    chery: 'Chery', alfa: 'Alfa Romeo', 'alfa-romeo': 'Alfa Romeo',
    mini: 'Mini', 'land-rover': 'Land Rover', 'range-rover': 'Land Rover',
  };
  return map[m] ?? makeRaw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

const FUEL_MAP: Record<string, string> = {
  'benzin': 'Benzin', 'dizel': 'Dizel', 'lpg': 'Benzin + LPG',
  'elektrik': 'Elektrik', 'hibrit': 'Hybrid', 'hybrid': 'Hybrid',
};

const TRANSMISSION_MAP: Record<string, string> = {
  'manuel': 'Manuel', 'otomatik': 'Otomatik',
  'yarı-otomatik': 'Yarı Otomatik', 'yari-otomatik': 'Yarı Otomatik',
  'dsg': 'Yarı Otomatik', 'cvt': 'Yarı Otomatik',
  'powershift': 'Yarı Otomatik', 'edc': 'Yarı Otomatik',
  'eat8': 'Otomatik', 'eat6': 'Otomatik', 'at8': 'Otomatik',
};

// ── Axios config ────────────────────────────────────────────────────────

function makeAxiosConfig(): AxiosRequestConfig {
  return {
    timeout: HTTP_TIMEOUT,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    },
  };
}

// ── Parse listing URL slug ──────────────────────────────────────────────
//
// Otosor URL format:
//   /ilan/{make}-{model}-{trim}-{hp}hp-{transmission}-{fuel}-{year}-{id}
//
// Example:
//   /ilan/fiat-linea-1-3-multijet-pop-95hp-manuel-dizel-2012-1093647
//   make=fiat, model=linea, trim=1.3 multijet pop, hp=95, transmission=manuel,
//   fuel=dizel, year=2012, id=1093647

interface ParsedSlug {
  make: string;
  model: string;
  year: number;
  fuelType?: string;
  transmission?: string;
  listingId: string;
}

function parseSlug(url: string): ParsedSlug | null {
  const match = url.match(/\/ilan\/(.+)-(\d+)$/);
  if (!match) return null;

  const slug = match[1]; // e.g. "fiat-linea-1-3-multijet-pop-95hp-manuel-dizel-2012"
  const listingId = match[2];

  const parts = slug.split('-');

  // Find make (first part that matches known makes)
  let makeIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (KNOWN_MAKES.includes(parts[i].toLowerCase())) {
      makeIdx = i;
      break;
    }
  }
  if (makeIdx === -1) return null;

  const make = normalizeMake(parts[makeIdx]);

  // Find year (4-digit number between 1990-2030)
  let year = 0;
  let yearIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    const y = parseInt(parts[i], 10);
    if (y >= 1990 && y <= 2030) {
      year = y;
      yearIdx = i;
      break;
    }
  }
  if (!year) return null;

  // Find HP (e.g. "95hp", "140hp")
  let hpIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].endsWith('hp')) {
      hpIdx = i;
      break;
    }
  }

  // Find fuel type (benzin, dizel, lpg, elektrik, hibrit)
  let fuelType: string | undefined;
  let fuelIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (FUEL_MAP[parts[i].toLowerCase()]) {
      fuelType = FUEL_MAP[parts[i].toLowerCase()];
      fuelIdx = i;
      break;
    }
  }

  // Find transmission (manuel, otomatik, etc.)
  let transmission: string | undefined;
  let transIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (TRANSMISSION_MAP[parts[i].toLowerCase()]) {
      transmission = TRANSMISSION_MAP[parts[i].toLowerCase()];
      transIdx = i;
      break;
    }
  }

  // Model = everything between make and the first keyword (hp/fuel/trans/year)
  const keywordStartIdx = Math.min(
    hpIdx >= 0 ? hpIdx : Infinity,
    fuelIdx >= 0 ? fuelIdx : Infinity,
    transIdx >= 0 ? transIdx : Infinity,
    yearIdx >= 0 ? yearIdx : Infinity,
  );

  const modelParts = parts.slice(makeIdx + 1, keywordStartIdx === Infinity ? parts.length : keywordStartIdx);
  const model = modelParts.join(' ').trim();

  return {
    make,
    model: model || 'Bilinmiyor',
    year,
    fuelType,
    transmission,
    listingId,
  };
}

// ── Fetch listing URLs from /araclar?page=N ─────────────────────────────

async function fetchListingUrls(maxPages: number): Promise<string[]> {
  const allUrls: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `${BASE_URL}/araclar?page=${page}`;
      console.log(`[otosor] Fetching page ${page}: ${url}`);
      const res = await axios.get(url, makeAxiosConfig());
      const $ = cheerio.load(res.data);

      // Find all /ilan/ links
      $('a[href*="/ilan/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('/ilan/') && !seen.has(href)) {
          // Skip non-listing URLs (e.g. /ilan-ver)
          if (!href.includes('/ilan-ver') && !href.includes('/ilanlarim')) {
            seen.add(href);
            allUrls.push(`${BASE_URL}${href}`);
          }
        }
      });

      console.log(`[otosor] Page ${page}: ${allUrls.length} total URLs so far`);

      // Be polite
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.warn(`[otosor] Failed to fetch page ${page}:`, (err as Error).message);
    }
  }

  return allUrls;
}

// ── Fetch detail page and parse price ───────────────────────────────────

const PRICE_RE = /"price"\s*:\s*"?(\d{5,})"?/;

async function fetchAndParseOne(url: string, slugData: ParsedSlug): Promise<ListingRaw | null> {
  try {
    const res = await axios.get(url, makeAxiosConfig());
    const html = res.data as string;

    // Price: "500.000₺"
    const priceMatch = html.match(PRICE_RE);
    if (!priceMatch) return null;
    const price = parseInt(priceMatch[1].replace(/\./g, ''), 10);
    if (!price || price < 10000) return null;

    // Image — Otosor stores image URLs in JSON: "image":"https://storage.googleapis.com/..."
    // og:image meta tag is not present, so we use JSON instead.
    const imgMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
    const imageUrl = imgMatch?.[1];

    // City (try to find in page)
    let city: string | undefined;
    const cityMatch = html.match(/class="[^"]*location[^"]*"[^>]*>([^<]{2,30})</i);
    if (cityMatch) city = cityMatch[1].trim().toLowerCase();

    return {
      sourceName: 'otosor',
      sourceUrl: url,
      vin: undefined,
      make: slugData.make,
      model: slugData.model,
      trim: undefined,
      year: slugData.year,
      price,
      currency: 'TRY',
      mileageKm: undefined,
      fuelType: slugData.fuelType,
      transmission: slugData.transmission,
      bodyType: undefined,
      color: undefined,
      city,
      district: undefined,
      sellerType: 'Galeri', // Otosor is a dealer platform
      imageUrl,
      imageUrls: imageUrl ? [imageUrl] : [],
      description: undefined,
    };
  } catch (err) {
    return null;
  }
}

// ── Parallel fetch + parse ──────────────────────────────────────────────

async function fetchAndParseBatch(
  items: Array<{ url: string; slug: ParsedSlug }>,
): Promise<ListingRaw[]> {
  const results: ListingRaw[] = [];
  const queue = [...items];

  const workers: Promise<void>[] = [];
  for (let w = 0; w < MAX_PARALLEL_FETCHES; w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const parsed = await fetchAndParseOne(item.url, item.slug);
        if (parsed) results.push(parsed);
      }
    })());
  }
  await Promise.all(workers);
  return results;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Live-scrape Otosor for listings.
 *
 * @param targetCount How many valid listings to return (default 30)
 */
export async function liveScrapeOtosor(targetCount: number = 30): Promise<ListingRaw[]> {
  console.log(`[otosor] liveScrapeOtosor: target=${targetCount}`);

  // Step 1: Fetch listing URLs from /araclar pages
  const pagesToScan = Math.min(Math.ceil(targetCount / 8) + 2, MAX_PAGES_TO_SCAN);
  const urls = await fetchListingUrls(pagesToScan);
  if (urls.length === 0) return [];

  // Step 2: Parse slugs
  const parsed: Array<{ url: string; slug: ParsedSlug }> = [];
  for (const url of urls) {
    const slug = parseSlug(url);
    if (slug) {
      parsed.push({ url, slug });
    }
  }

  console.log(`[otosor] Parsed ${parsed.length}/${urls.length} URLs`);

  // Step 3: Fetch detail pages in parallel
  const toFetch = parsed.slice(0, Math.min(parsed.length, targetCount * 2));
  const listings = await fetchAndParseBatch(toFetch);

  console.log(`[otosor] Final: ${listings.length} listings`);
  return listings.slice(0, targetCount);
}

/**
 * Bulk-scrape Otosor for DB population (cron-triggered).
 *
 * @param maxListings Cap on total listings (default 200)
 */
export async function bulkScrapeOtosor(maxListings: number = 200): Promise<{
  listings: ListingRaw[];
  totalUrls: number;
  pagesScanned: number;
}> {
  console.log(`[otosor] bulkScrapeOtosor: max=${maxListings}`);

  const pagesToScan = Math.min(Math.ceil(maxListings / 8) + 2, MAX_PAGES_TO_SCAN);
  const urls = await fetchListingUrls(pagesToScan);

  const parsed: Array<{ url: string; slug: ParsedSlug }> = [];
  for (const url of urls) {
    const slug = parseSlug(url);
    if (slug) parsed.push({ url, slug });
  }

  const toFetch = parsed.slice(0, Math.min(parsed.length, maxListings * 2));
  const listings = await fetchAndParseBatch(toFetch);

  return {
    listings: listings.slice(0, maxListings),
    totalUrls: urls.length,
    pagesScanned: pagesToScan,
  };
}
