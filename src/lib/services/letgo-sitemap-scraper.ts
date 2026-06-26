// Otodedektif - Runtime Letgo sitemap scraper
//
// Strategy:
//   - Fetch sitemap-items-N.xml (each ~50K URLs)
//   - Filter URLs by slug: must contain known car make, must NOT contain
//     part/accessory keywords
//   - If user filters provided, pre-filter URLs by slug
//   - Fetch detail pages in parallel (8 concurrent)
//   - Parse and return ListingRaw[]
//
// Caching: Sitemap XML responses cached in memory for 1 hour.

import axios, { type AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import type { ListingRaw } from '@/lib/adapters/base';
import { isPartOrAccessory } from './parts-filter';
import type { SearchFilters } from '@/lib/types';

const SITEMAP_INDEX_URL = 'https://www.letgo.com/sitemap-item-index.xml';
const USER_AGENT = 'OtodedektifBot/1.0 (+https://otodedektif.vercel.app)';
const HTTP_TIMEOUT = 15_000;
const SITEMAP_CACHE_TTL = 60 * 60 * 1000;
const MAX_PARALLEL_FETCHES = 8;
const MAX_SITEMAPS_TO_SCAN = 3;
const MAX_DETAIL_PAGES_PER_REQUEST = 30;

const KNOWN_MAKES = [
  'bmw', 'mercedes', 'mercedes-benz', 'audi', 'volkswagen', 'vw', 'toyota',
  'honda', 'hyundai', 'ford', 'renault', 'fiat', 'peugeot', 'opel',
  'citroen', 'volvo', 'mazda', 'nissan', 'kia', 'skoda', 'seat', 'suzuki',
  'mitsubishi', 'chevrolet', 'jeep', 'lexus', 'infiniti', 'dacia', 'tofas',
  'chery', 'alfa-romeo', 'mini', 'land-rover', 'range-rover',
];

const PART_KEYWORDS = [
  'yedek-parca', 'yedek-parça', 'parca', 'parça', 'aksesuar',
  'orjinal', 'sifir-parca', 'jant', 'lastik',
  'far', 'stop', 'ayna', 'kapi', 'bagaj', 'rulman',
  'sanayi', 'sigorta', 'bakim', 'bakım', 'tramer',
  'balata', 'amortisor', 'ekzos', 'egzos',
  'salincak', 'suspansiyon', 'kampana',
  'buzdolabi', 'camasir', 'bulasik',
  'tv', 'telefon', 'saat', 'kulaklik',
  'cybertruck', 'hot-wheels', 'hotwheels', 'oyuncak',
  'cicek', 'tekstil', 'kumas',
  'kolye', 'bilezik', 'kupe', 'yuzuk',
  'antika', 'dekor', 'mobilya', 'sehpa',
];

interface CachedSitemap {
  urls: string[];
  fetchedAt: number;
}

const sitemapCache = new Map<string, CachedSitemap>();
const sitemapIndexCache: CachedSitemap = { urls: [], fetchedAt: 0 };

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

function normalizeMake(makeRaw: string): string {
  if (!makeRaw) return '';
  const m = makeRaw.toLowerCase().trim();
  const map: Record<string, string> = {
    vw: 'Volkswagen',
    mercedes: 'Mercedes-Benz',
    'mercedes-benz': 'Mercedes-Benz',
    bmw: 'BMW',
    audi: 'Audi',
    toyota: 'Toyota',
    honda: 'Honda',
    hyundai: 'Hyundai',
    ford: 'Ford',
    renault: 'Renault',
    fiat: 'Fiat',
    peugeot: 'Peugeot',
    opel: 'Opel',
    citroen: 'Citroen',
    volvo: 'Volvo',
    mazda: 'Mazda',
    nissan: 'Nissan',
    kia: 'Kia',
    skoda: 'Skoda',
    seat: 'Seat',
    suzuki: 'Suzuki',
    mitsubishi: 'Mitsubishi',
    chevrolet: 'Chevrolet',
    jeep: 'Jeep',
    lexus: 'Lexus',
    infiniti: 'Infiniti',
    dacia: 'Dacia',
    tofas: 'Tofaş',
    chery: 'Chery',
    alfa: 'Alfa Romeo',
    'alfa-romeo': 'Alfa Romeo',
    mini: 'Mini',
    'land-rover': 'Land Rover',
    'range-rover': 'Land Rover',
  };
  return map[m] ?? makeRaw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function isCarUrl(url: string): boolean {
  const slug = url.toLowerCase();
  if (!slug.includes('/item/')) return false;
  if (PART_KEYWORDS.some((kw) => slug.includes(kw))) return false;
  return KNOWN_MAKES.some((make) => slug.includes(`-${make}-`) || slug.endsWith(`-${make}`));
}

async function fetchSitemapIndex(): Promise<string[]> {
  const now = Date.now();
  if (sitemapIndexCache.urls.length > 0 && now - sitemapIndexCache.fetchedAt < SITEMAP_CACHE_TTL) {
    return sitemapIndexCache.urls;
  }
  try {
    const res = await axios.get(SITEMAP_INDEX_URL, makeAxiosConfig());
    const $ = cheerio.load(res.data, { xmlMode: true });
    const urls = $('sitemap > loc').map((_, el) => $(el).text().trim()).get();
    sitemapIndexCache.urls = urls;
    sitemapIndexCache.fetchedAt = now;
    return urls;
  } catch (err) {
    console.error('[letgo-sitemap] Failed to fetch sitemap index:', (err as Error).message);
    return [];
  }
}

async function fetchSitemap(url: string): Promise<string[]> {
  const now = Date.now();
  const cached = sitemapCache.get(url);
  if (cached && now - cached.fetchedAt < SITEMAP_CACHE_TTL) {
    return cached.urls;
  }
  try {
    const res = await axios.get(url, makeAxiosConfig());
    const $ = cheerio.load(res.data, { xmlMode: true });
    const urls = $('url > loc').map((_, el) => $(el).text().trim()).get();
    sitemapCache.set(url, { urls, fetchedAt: now });
    return urls;
  } catch (err) {
    console.warn(`[letgo-sitemap] Failed to fetch ${url}:`, (err as Error).message);
    return [];
  }
}

function filterUrlsByUserFilters(urls: string[], filters?: SearchFilters): string[] {
  let filtered = urls.filter(isCarUrl);

  if (filters?.make) {
    const makeLower = filters.make.toLowerCase();
    const slugAliases: Record<string, string[]> = {
      volkswagen: ['volkswagen', 'vw'],
      'mercedes-benz': ['mercedes', 'mercedes-benz'],
      'alfa romeo': ['alfa-romeo', 'alfa'],
      'land rover': ['land-rover', 'range-rover'],
      'tofaş': ['tofas'],
    };
    const aliases = slugAliases[makeLower] ?? [makeLower];
    filtered = filtered.filter((url) => {
      const slug = url.toLowerCase();
      return aliases.some((a) => slug.includes(`-${a}-`) || slug.endsWith(`-${a}`));
    });
  }

  if (filters?.fuelType) {
    const fuelMap: Record<string, string[]> = {
      'Benzin': ['benzin', 'benzinli'],
      'Dizel': ['dizel', 'dizeli', 'diesel', 'tdi', 'cdi', 'hdi'],
      'LPG': ['lpg', 'lpgli'],
      'Elektrik': ['elektrik', 'elektrikli'],
      'Hybrid': ['hibrit', 'hybrid'],
    };
    const hints = fuelMap[filters.fuelType] ?? [];
    if (hints.length > 0) {
      filtered = filtered.filter((url) => {
        const slug = url.toLowerCase();
        return hints.some((h) => slug.includes(h));
      });
    }
  }

  return filtered;
}

const PRICE_RE = /([0-9]{1,3}(?:\.[0-9]{3})+)\s*TL/i;
const YEAR_RE = /\b(19[9]\d|20\d{2})\b/;
const KM_RE = /([0-9]{1,3}(?:\.[0-9]{3})+)\s*km/i;
const OG_TITLE_RE = /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i;
const OG_IMAGE_RE = /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i;
const ITEM_LINK_RE = /\/item\/([^/?"']+)-iid-(\d+)/;

const FUEL_KEYWORDS: Record<string, string> = {
  benzin: 'Benzin', benzini: 'Benzin',
  dizel: 'Dizel', dizeli: 'Dizel',
  lpg: 'Benzin + LPG', lpgli: 'Benzin + LPG',
  elektrik: 'Elektrik',
  hibrit: 'Hybrid', hybrid: 'Hybrid',
};

const TRANSMISSION_KEYWORDS: Record<string, string> = {
  manuel: 'Manuel',
  otomatik: 'Otomatik',
  'yarı otomatik': 'Yarı Otomatik',
  'yari otomatik': 'Yarı Otomatik',
  dsg: 'Yarı Otomatik',
  cvt: 'Yarı Otomatik',
};

const TURKISH_CITIES = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya',
  'gaziantep', 'mersin', 'diyarbakır', 'diyarbakir', 'kayseri', 'eskişehir',
  'eskisehir', 'samsun', 'denizli', 'malatya', 'trabzon', 'erzurum',
  'muğla', 'mugla', 'aydın', 'aydin', 'balıkesir', 'balikesir',
];

function parseListingPage(url: string, html: string): ListingRaw | null {
  const titleMatch = html.match(OG_TITLE_RE);
  let title = titleMatch?.[1]?.trim() ?? '';
  if (!title) return null;

  const titleLower = title.toLowerCase();
  const skipKeywords = ['yedek parça', 'yedek parca', 'aksesuar', 'kask', 'lastik',
                        'jant', 'motor yağı', 'sigorta', 'kiralık', 'kiralik'];
  if (skipKeywords.some((kw) => titleLower.includes(kw))) return null;

  const slugMatch = url.match(ITEM_LINK_RE);
  const slug = slugMatch?.[1] ?? '';
  const parts = title.split(/\s+/);

  let makeRaw = '';
  let model = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].toLowerCase();
    if (KNOWN_MAKES.includes(p)) {
      makeRaw = parts[i];
      model = parts.slice(i + 1).join(' ');
      break;
    }
  }
  if (!makeRaw) {
    for (const m of KNOWN_MAKES) {
      if (slug.includes(`-${m}-`) || slug.endsWith(`-${m}`)) {
        makeRaw = m;
        break;
      }
    }
    if (parts.length > 1) model = parts.slice(1).join(' ');
  }

  const make = normalizeMake(makeRaw);
  if (!make || make.length < 2) return null;

  const priceMatch = html.match(PRICE_RE);
  if (!priceMatch) return null;
  const price = parseInt(priceMatch[1].replace(/\./g, ''), 10);
  if (!price || price < 10000) return null;

  let year = 0;
  const maxYear = new Date().getFullYear() + 1;
  const slugYearMatch = slug.replace(/-/g, ' ').match(YEAR_RE);
  if (slugYearMatch) {
    const y = parseInt(slugYearMatch[1], 10);
    if (1990 <= y && y <= maxYear) year = y;
  }
  if (!year) {
    const titleYearMatch = title.match(YEAR_RE);
    if (titleYearMatch) {
      const y = parseInt(titleYearMatch[1], 10);
      if (1990 <= y && y <= maxYear) year = y;
    }
  }
  if (!year) return null;

  let mileage: number | undefined;
  const kmMatch = html.match(KM_RE);
  if (kmMatch) {
    const km = parseInt(kmMatch[1].replace(/\./g, ''), 10);
    if (km > 0 && km < 1_000_000) mileage = km;
  }

  const htmlLower = html.toLowerCase();
  let fuel: string | undefined;
  for (const [kw, val] of Object.entries(FUEL_KEYWORDS)) {
    if (htmlLower.includes(kw)) { fuel = val; break; }
  }

  let transmission: string | undefined;
  for (const [kw, val] of Object.entries(TRANSMISSION_KEYWORDS)) {
    if (htmlLower.includes(kw)) { transmission = val; break; }
  }

  let city: string | undefined;
  for (const c of TURKISH_CITIES) {
    if (htmlLower.includes(c)) { city = c; break; }
  }

  const imgMatch = html.match(OG_IMAGE_RE);
  const imageUrl = imgMatch?.[1];

  const listing: ListingRaw = {
    sourceName: 'letgo', sourceUrl: url, vin: undefined,
    make, model: model || 'Bilinmiyor', trim: undefined,
    year, price, currency: 'TRY',
    mileageKm: mileage, fuelType: fuel, transmission,
    bodyType: undefined, color: undefined,
    city, district: undefined,
    sellerType: 'Sahibinden',
    imageUrl, imageUrls: imageUrl ? [imageUrl] : [],
    description: title,
  };

  // Parça/yedek parça filtresi — parça ise DB'ye yazma
  if (isPartOrAccessory(listing)) {
    return null;
  }

  return listing;
}

async function fetchAndParseOne(url: string): Promise<ListingRaw | null> {
  try {
    const res = await axios.get(url, makeAxiosConfig());
    return parseListingPage(url, res.data);
  } catch (err) {
    return null;
  }
}

async function fetchAndParseBatch(urls: string[]): Promise<ListingRaw[]> {
  const results: ListingRaw[] = [];
  const queue = [...urls];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < MAX_PARALLEL_FETCHES; w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        if (!url) break;
        const parsed = await fetchAndParseOne(url);
        if (parsed) results.push(parsed);
      }
    })());
  }
  await Promise.all(workers);
  return results;
}

export async function liveScrapeLetgo(
  filters?: SearchFilters,
  targetCount: number = 30,
): Promise<ListingRaw[]> {
  console.log(`[letgo-sitemap] liveScrapeLetgo: target=${targetCount}, filters=`, filters);

  const sitemapUrls = await fetchSitemapIndex();
  if (sitemapUrls.length === 0) return [];

  const shuffled = [...sitemapUrls].sort(() => Math.random() - 0.5);
  const sitemapsToScan = shuffled.slice(0, MAX_SITEMAPS_TO_SCAN);

  const collected: ListingRaw[] = [];
  const urlsNeeded = targetCount * 3;

  for (const smUrl of sitemapsToScan) {
    if (collected.length >= targetCount) break;

    const allUrls = await fetchSitemap(smUrl);
    const filtered = filterUrlsByUserFilters(allUrls, filters);
    if (filtered.length === 0) continue;

    const shuffledFiltered = filtered.sort(() => Math.random() - 0.5);
    const toFetch = shuffledFiltered.slice(0, Math.min(MAX_DETAIL_PAGES_PER_REQUEST, urlsNeeded - collected.length * 3));

    console.log(`[letgo-sitemap] ${smUrl}: ${allUrls.length} URLs → ${filtered.length} filtered → fetching ${toFetch.length}`);

    const batch = await fetchAndParseBatch(toFetch);
    collected.push(...batch);
    console.log(`[letgo-sitemap] Batch: ${batch.length} valid (total: ${collected.length})`);

    if (collected.length >= targetCount) break;
  }

  console.log(`[letgo-sitemap] Final: ${collected.length} listings`);
  return collected.slice(0, targetCount);
}

export async function bulkScrapeLetgo(
  maxListings: number = 500,
  sitemapCount: number = 5,
): Promise<{ listings: ListingRaw[]; scannedSitemaps: number; totalUrls: number; carUrls: number }> {
  console.log(`[letgo-sitemap] bulkScrapeLetgo: max=${maxListings}, sitemaps=${sitemapCount}`);

  const sitemapUrls = await fetchSitemapIndex();
  if (sitemapUrls.length === 0) {
    return { listings: [], scannedSitemaps: 0, totalUrls: 0, carUrls: 0 };
  }

  const shuffled = [...sitemapUrls].sort(() => Math.random() - 0.5);
  const sitemapsToScan = shuffled.slice(0, Math.min(sitemapCount, sitemapUrls.length));

  const collected: ListingRaw[] = [];
  let totalUrls = 0;
  let carUrls = 0;
  const seenUrls = new Set<string>();

  for (const smUrl of sitemapsToScan) {
    if (collected.length >= maxListings) break;

    const allUrls = await fetchSitemap(smUrl);
    totalUrls += allUrls.length;

    const filtered = allUrls.filter((u) => isCarUrl(u) && !seenUrls.has(u));
    filtered.forEach((u) => seenUrls.add(u));
    carUrls += filtered.length;

    if (filtered.length === 0) continue;

    const chunk = filtered.slice(0, 100);
    console.log(`[letgo-sitemap] ${smUrl}: ${allUrls.length} URLs, ${filtered.length} cars, fetching ${chunk.length}`);

    const batch = await fetchAndParseBatch(chunk);
    collected.push(...batch);
    console.log(`[letgo-sitemap] Batch: ${batch.length} valid (total: ${collected.length}/${maxListings})`);
  }

  return {
    listings: collected.slice(0, maxListings),
    scannedSitemaps: sitemapsToScan.length,
    totalUrls, carUrls,
  };
}

export function clearSitemapCache(): void {
  sitemapCache.clear();
  sitemapIndexCache.urls = [];
  sitemapIndexCache.fetchedAt = 0;
}
