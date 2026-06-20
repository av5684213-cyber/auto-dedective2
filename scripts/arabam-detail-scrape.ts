#!/usr/bin/env bun
/**
 * arabam.com DETAY sayfası scraper — Wayback Machine üzerinden.
 *
 * Önceki scraper sadece listing (arama sonuçları) sayfasından JSON-LD alıyordu.
 * Bu scraper her ilanın DETAY sayfasına gidip tam veriyi çekiyor:
 *   - .product-name-container → başlık
 *   - .product-price → fiyat
 *   - .product-properties-details .property-item → yıl, km, yakıt, vites, kasa, renk, il, kimden
 *   - #tab-description → açıklama
 *   - .slider-container .swiper-slide img → görseller
 *   - .advert-owner-name → satıcı adı
 *   - .product-location → konum
 *
 * Letgo verisine DOKUNMAZ — UPSERT anahtarı sourceUrl.
 *
 * Kullanım:
 *   bun run scripts/arabam-detail-scrape.ts
 *   bun run scripts/arabam-detail-scrape.ts --max=30
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { normalizeListing } from '@/lib/services/normalizer';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import type { RawListing } from '@/lib/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function arg(name: string, fallback?: string): string | undefined {
  const flag = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(flag));
  return found ? found.slice(flag.length) : fallback;
}

const MAX_DETAILS = parseInt(arg('max', '50')!, 10);
const CONCURRENCY = parseInt(arg('concurrency', '3')!, 10);

// ── Turkish normalizers ───────────────────────────────────────────────
const MAKES_NORMALIZE: Record<string, string> = {
  'bmw': 'BMW',
  'mercedes-benz': 'Mercedes-Benz', 'mercedes': 'Mercedes-Benz',
  'volkswagen': 'Volkswagen', 'vw': 'Volkswagen',
  'audi': 'Audi', 'toyota': 'Toyota', 'honda': 'Honda',
  'hyundai': 'Hyundai', 'renault': 'Renault', 'fiat': 'Fiat',
  'ford': 'Ford', 'opel': 'Opel', 'peugeot': 'Peugeot',
  'citroen': 'Citroen', 'skoda': 'Skoda', 'seat': 'Seat',
  'kia': 'Kia', 'nissan': 'Nissan', 'mazda': 'Mazda',
  'volvo': 'Volvo', 'mitsubishi': 'Mitsubishi', 'dacia': 'Dacia',
  'chevrolet': 'Chevrolet', 'chery': 'Chery', 'jeep': 'Jeep',
  'lexus': 'Lexus', 'mini': 'Mini', 'subaru': 'Subaru',
  'suzuki': 'Suzuki', 'alfa-romeo': 'Alfa Romeo', 'alfa romeo': 'Alfa Romeo',
  'land rover': 'Land Rover', 'range rover': 'Land Rover',
  'porsche': 'Porsche', ' infiniti': 'Infiniti', 'infiniti': 'Infiniti',
  'cadillac': 'Cadillac', 'bentley': 'Bentley',
};

function normalizeMake(make: string): string {
  const lower = make.toLowerCase().trim();
  return MAKES_NORMALIZE[lower] || make.trim();
}

const FUEL_NORMALIZE: Record<string, string> = {
  'benzin': 'Benzin', 'gasoline': 'Benzin', 'petrol': 'Benzin',
  'dizel': 'Dizel', 'diesel': 'Dizel',
  'lpg': 'LPG',
  'lpg & benzin': 'Benzin + LPG', 'benzin & lpg': 'Benzin + LPG',
  'lpg + benzin': 'Benzin + LPG', 'benzin + lpg': 'Benzin + LPG',
  'benzin+lpg': 'Benzin + LPG', 'lpg+benzin': 'Benzin + LPG',
  'hybrid': 'Hybrid', 'hibrit': 'Hybrid',
  'elektrik': 'Elektrik', 'electric': 'Elektrik',
};

function normalizeFuel(fuel: string): string | undefined {
  if (!fuel) return undefined;
  return FUEL_NORMALIZE[fuel.toLowerCase().trim()] || fuel;
}

const TRANSMISSION_NORMALIZE: Record<string, string> = {
  'manuel': 'Manuel', 'manual': 'Manuel', 'düz': 'Manuel', 'duz': 'Manuel',
  'otomatik': 'Otomatik', 'automatic': 'Otomatik',
  'yarı otomatik': 'Yarı Otomatik', 'yari otomatik': 'Yarı Otomatik',
  'semi-automatic': 'Yarı Otomatik',
  'dsg': 'Yarı Otomatik', 'edc': 'Yarı Otomatik', 'tiptronic': 'Yarı Otomatik',
  'cvt': 'Otomatik',
};

function normalizeTransmission(trans: string): string | undefined {
  if (!trans) return undefined;
  return TRANSMISSION_NORMALIZE[trans.toLowerCase().trim()] || trans;
}

const BODY_NORMALIZE: Record<string, string> = {
  'sedan': 'Sedan',
  'hatchback': 'Hatchback', 'hatchback/3': 'Hatchback', 'hatchback/5': 'Hatchback',
  'station wagon': 'Station Wagon', 'station': 'Station Wagon',
  'suv': 'SUV',
  'coupe': 'Coupe', 'cabrio': 'Cabrio', 'cabriolet': 'Cabrio',
  'mpv': 'MPV', 'minivan': 'MPV',
  'pickup': 'Pickup', 'pick-up': 'Pickup',
  'roadster': 'Cabrio',
};

function normalizeBody(body: string): string | undefined {
  if (!body) return undefined;
  return BODY_NORMALIZE[body.toLowerCase().trim()] || body;
}

const COLOR_NORMALIZE: Record<string, string> = {
  'beyaz': 'Beyaz', 'white': 'Beyaz',
  'siyah': 'Siyah', 'black': 'Siyah',
  'gri': 'Gri', 'gray': 'Gri', 'grey': 'Gri',
  'kırmızı': 'Kırmızı', 'kirmizi': 'Kırmızı', 'red': 'Kırmızı',
  'mavi': 'Mavi', 'blue': 'Mavi',
  'yeşil': 'Yeşil', 'yesil': 'Yeşil', 'green': 'Yeşil',
  'gümüş': 'Gümüş', 'gumus': 'Gümüş', 'silver': 'Gümüş',
  'sarı': 'Sarı', 'sari': 'Sarı', 'yellow': 'Sarı',
  'turuncu': 'Turuncu', 'orange': 'Turuncu',
  'kahverengi': 'Kahverengi', 'brown': 'Kahverengi',
  'mor': 'Mor', 'purple': 'Mor',
  'bej': 'Bej', 'beige': 'Bej',
  'bordeaux': 'Bordo', 'bordo': 'Bordo',
  'lacivert': 'Lacivert',
};

function normalizeColor(color: string): string | undefined {
  if (!color) return undefined;
  return COLOR_NORMALIZE[color.toLowerCase().trim()] || color;
}

function normalizeSellerType(seller: string): string | undefined {
  if (!seller) return undefined;
  const s = seller.toLowerCase().trim();
  if (s.includes('galeri')) return 'Galeri';
  if (s.includes('sahib')) return 'Sahibinden';
  if (s.includes('yetkili') || s.includes('bayi')) return 'Yetkili Bayi';
  return seller;
}

/** Extract make/model from URL slug */
function extractMakeModelFromUrl(url: string): { make: string; model: string } {
  const m = url.match(/\/ilan\/(?:galeriden|sahibinden)-satilik-([^/]+)/);
  if (!m) return { make: '', model: '' };
  const fullSlug = m[1];
  for (const makeKey of Object.keys(MAKES_NORMALIZE)) {
    if (fullSlug.startsWith(makeKey + '-')) {
      const make = MAKES_NORMALIZE[makeKey];
      const modelSlug = fullSlug.substring(makeKey.length + 1);
      const model = modelSlug
        .split('-')
        .filter(Boolean)
        .map(word => /^\d$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/(\d)\s+(\d)\b/g, '$1.$2')
        .trim();
      return { make, model };
    }
  }
  return { make: '', model: '' };
}

// ── Step 1: Get detail page URLs from Wayback CDX API ────────────────
// (Listing page snapshots don't have archived detail pages, but CDX has
// direct snapshots of /ilan/{slug}/{dealer}/{id} URLs from 2025 onwards)
async function getArchivedDetailUrls(): Promise<{ timestamp: string; url: string }[]> {
  // Try cache file first (CDX API is slow and times out frequently)
  const cacheFile = '/tmp/archived-details.json';
  try {
    const cached = await import('fs').then(fs => fs.readFileSync(cacheFile, 'utf-8'));
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log(`  Using cached CDX results: ${parsed.length} URLs`);
      return parsed;
    }
  } catch {}
  
  // Multiple CDX queries with different URL patterns (parallel for speed)
  const queries = [
    'https://web.archive.org/cdx/search/cdx?url=arabam.com/ilan/galeriden-satilik-*&output=json&limit=300&from=20250601&filter=statuscode:200&collapse=urlkey',
    'https://web.archive.org/cdx/search/cdx?url=arabam.com/ilan/sahibinden-satilik-*&output=json&limit=300&from=20250601&filter=statuscode:200&collapse=urlkey',
  ];
  
  const detailUrls: { timestamp: string; url: string }[] = [];
  const seen = new Set<string>();
  
  for (const cdxUrl of queries) {
    console.log(`  Querying CDX: ${cdxUrl.substring(80, 120)}...`);
    try {
      const res = await axios.get(cdxUrl, { timeout: 45000 });
      const entries = (res.data as any[][]).slice(1);
      console.log(`    Found ${entries.length} CDX entries`);
      
      for (const row of entries) {
        const url: string = row[2];
        const m = url.match(/^https?:\/\/(?:www\.)?arabam\.com\/ilan\/(galeriden|sahibinden)-satilik-[^/]+\/[^/]+\/\d+\/?$/);
        if (m && !seen.has(url)) {
          seen.add(url);
          detailUrls.push({ timestamp: row[1], url });
        }
      }
    } catch (e: any) {
      console.log(`    CDX query failed: ${e.message.substring(0, 80)}`);
    }
  }
  
  console.log(`  Total unique detail page URLs: ${detailUrls.length}`);
  
  // Cache for future runs
  try {
    await import('fs').then(fs => fs.writeFileSync(cacheFile, JSON.stringify(detailUrls, null, 2)));
    console.log(`  Cached to ${cacheFile}`);
  } catch {}
  
  return detailUrls;
}

// ── Step 2: Fetch + parse detail page ────────────────────────────────
async function fetchDetailPage(
  realUrl: string,
  timestamp?: string,
  retries = 2,
): Promise<string> {
  // If we have a specific timestamp from CDX, use it (most reliable)
  const candidates: string[] = [];
  if (timestamp) {
    candidates.push(`https://web.archive.org/web/${timestamp}id_/${realUrl}`);
    candidates.push(`https://web.archive.org/web/${timestamp}/${realUrl}`);
  } else {
    // Fallback: try without specific timestamp
    candidates.push(`https://web.archive.org/web/2025/${realUrl}`);
    candidates.push(`https://web.archive.org/web/2024/${realUrl}`);
    candidates.push(`https://web.archive.org/web/${realUrl}`);
  }
  
  for (const waybackUrl of candidates) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await axios.get(waybackUrl, {
          headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
          timeout: 30000,
          validateStatus: () => true,
          maxRedirects: 5,
        });
        if (res.status === 200 && res.data.length > 50000) {
          return res.data;
        }
      } catch {}
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return '';
}

function parseDetailPage(html: string, sourceUrl: string): RawListing | null {
  const $ = cheerio.load(html);
  
  // ─── CANONICAL URL — kullanıcının tıklayınca gideceği GERÇEK ilan linki ───
  // arabam.com bazen listing URL'lerini redirect eder; canonical URL her zaman doğrudur
  let canonicalUrl = '';
  const canonicalEl = $('link[rel="canonical"]').first();
  if (canonicalEl.length) {
    canonicalUrl = canonicalEl.attr('href') || '';
    // Strip wayback prefix if present
    const m = canonicalUrl.match(/\/web\/\d+(?:im_|if_|id_)?\/(https?:\/\/.+)/);
    if (m) canonicalUrl = m[1];
    if (canonicalUrl && !canonicalUrl.startsWith('http')) {
      canonicalUrl = `https://www.arabam.com${canonicalUrl.startsWith('/') ? '' : '/'}${canonicalUrl}`;
    }
  }
  // finalUrl: canonical tercih, fallback sourceUrl
  const finalUrl = canonicalUrl || sourceUrl;
  
  // ─── Title ───
  let title = '';
  const titleEl = $('.product-name-container').first();
  if (titleEl.length) {
    title = titleEl.text().trim();
  } else {
    // Fallback: <title> tag (wayback-modified)
    const pageTitle = $('title').text().trim();
    // Strip " - arabam.com" or wayback prefix
    title = pageTitle.replace(/\s*-\s*arabam\.com.*$/i, '').replace(/^.*arabam\.com\s*-\s*/i, '');
  }
  
  // ─── Price ───
  let price = 0;
  const priceEl = $('.product-price').first();
  if (priceEl.length) {
    const text = priceEl.text().trim();
    const cleaned = text.replace(/[^0-9,.]/g, '').replace(/\./g, '').replace(/,/g, '.');
    price = parseFloat(cleaned) || 0;
  }
  
  // ─── Properties table ───
  // .product-properties-details .property-item each contains .property-key and .property-value
  const properties: Record<string, string> = {};
  $('.product-properties-details .property-item').each((_, el) => {
    const key = $(el).find('.property-key').text().trim();
    const value = $(el).find('.property-value').text().trim();
    if (key && value) properties[key] = value;
  });
  
  // Also try alternative property selectors (sometimes the page has different layout)
  if (Object.keys(properties).length === 0) {
    $('.property-item').each((_, el) => {
      const key = $(el).find('.property-key, .label, dt').text().trim();
      const value = $(el).find('.property-value, .value, dd').text().trim();
      if (key && value) properties[key] = value;
    });
  }
  
  // Try table rows too (older layout)
  if (Object.keys(properties).length === 0) {
    $('tr').each((_, el) => {
      const tds = $(el).find('td, th');
      if (tds.length === 2) {
        const key = $(tds[0]).text().trim();
        const value = $(tds[1]).text().trim();
        if (key && value && key.length < 30) properties[key] = value;
      }
    });
  }
  
  // Helper: find property by possible key names
  const findProp = (keys: string[]): string | undefined => {
    for (const k of keys) {
      for (const propKey of Object.keys(properties)) {
        if (propKey.toLowerCase().includes(k.toLowerCase())) {
          return properties[propKey];
        }
      }
    }
    return undefined;
  };
  
  const year = findProp(['yıl', 'yil', 'model yılı', 'production']) 
    ? parseInt((findProp(['yıl', 'yil']) || '').match(/\d{4}/)?.[0] || '0') 
    : 0;
  const kmStr = findProp(['kilometre', 'km']) || '';
  let mileageKm = kmStr ? parseInt(kmStr.replace(/[^0-9]/g, '')) || undefined : undefined;
  let fuelType = findProp(['yakıt', 'yakit', 'fuel']) ? normalizeFuel(findProp(['yakıt', 'yakit'])!) : undefined;
  let transmission = findProp(['vites', 'transmission', 'şanzıman']) 
    ? normalizeTransmission(findProp(['vites', 'transmission'])!) : undefined;
  let bodyType = findProp(['kasa', 'body', 'araç tipi', 'gövde']) 
    ? normalizeBody(findProp(['kasa', 'body'])!) : undefined;
  let color = findProp(['renk', 'color']) ? normalizeColor(findProp(['renk', 'color'])!) : undefined;
  // City — only from 'İl' / 'Şehir' property (NOT 'konum'/'location' which is district)
  const city = findProp(['il ', 'il$', 'şehir', 'sehir', 'city']);
  const sellerTypeStr = findProp(['kimden', 'satıcı', 'satici']) || '';
  let sellerType = sellerTypeStr ? normalizeSellerType(sellerTypeStr) : undefined;
  
  // ─── Description ───
  let description = '';
  const descEl = $('#tab-description p, .tab-description p, #tab-description, .tab-description').first();
  if (descEl.length) {
    description = descEl.text().trim().substring(0, 1000);
  }
  
  // ─── Images ───
  const imageUrls: string[] = [];
  $('.slider-container .swiper-slide img, .swiper-slide img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src && src.includes('mncdn.com')) {
      // Strip wayback prefix
      const m = src.match(/\/web\/\d+(?:im_)?\/(https?:\/\/.+)/);
      const cleanUrl = m ? m[1] : src;
      if (!imageUrls.includes(cleanUrl)) imageUrls.push(cleanUrl);
    }
  });
  
  // ─── Seller name ───
  const sellerName = $('.advert-owner-name').first().text().trim() || undefined;
  
  // ─── Location ───
  const location = $('.product-location span, .product-location').first().text().trim() || undefined;
  
  // ─── Make/Model ───
  let { make, model } = extractMakeModelFromUrl(finalUrl);
  if (!make && title) {
    const parts = title.trim().split(/\s+/);
    const firstWord = parts[0]?.toLowerCase() || '';
    if (MAKES_NORMALIZE[firstWord]) {
      make = MAKES_NORMALIZE[firstWord];
      model = parts.slice(1).join(' ');
    }
  }
  
  // If no price from .product-price, try JSON-LD as fallback
  if (price === 0) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).text());
        const vehicles = Array.isArray(parsed) ? parsed : [parsed];
        for (const v of vehicles) {
          if ((v['@type'] === 'Vehicle' || v['@type'] === 'Car') && v.offers?.price) {
            price = parseInt(String(v.offers.price).replace(/[^\d]/g, '')) || 0;
            if (!make && v.manufacturer) {
              const m = typeof v.manufacturer === 'object' ? v.manufacturer.name : v.manufacturer;
              make = normalizeMake(String(m || ''));
            }
            if (!mileageKm && v.mileageFromOdometer?.value) {
              mileageKm = parseInt(String(v.mileageFromOdometer.value)) || undefined;
            }
            if (!fuelType && v.vehicleEngine?.fuelType) {
              fuelType = normalizeFuel(String(v.vehicleEngine.fuelType));
            }
            if (!transmission && v.vehicleTransmission) {
              transmission = normalizeTransmission(String(v.vehicleTransmission));
            }
            if (!color && v.color) {
              color = normalizeColor(String(v.color));
            }
            break;
          }
        }
      } catch {}
    });
  }
  
  // Skip if no make or no price
  if (!make || price === 0) return null;
  
  // Build rich description
  const descParts: string[] = [];
  if (title) descParts.push(title);
  if (sellerName) descParts.push(`Satıcı: ${sellerName}`);
  if (location) descParts.push(`Konum: ${location}`);
  if (description) descParts.push(description);
  const fullDescription = descParts.join('\n\n');
  
  return {
    sourceName: 'arabam',
    sourceUrl: finalUrl,  // CANONICAL URL — kullanıcının tıklayınca gideceği gerçek ilan linki
    make,
    model,
    year,
    price,
    currency: 'TRY',
    mileageKm,
    fuelType,
    transmission,
    bodyType,
    color,
    city,
    sellerType,
    imageUrl: imageUrls[0] || undefined,
    imageUrls,
    description: fullDescription,
  };
}

// ── Step 3: Save to DB ───────────────────────────────────────────────
async function saveListing(raw: RawListing): Promise<'new' | 'updated' | 'error'> {
  try {
    const normalized = normalizeListing(raw) as any;
    if (!normalized.sourceUrl || !normalized.make) return 'error';
    
    const existing = await db.listing.findUnique({
      where: { sourceUrl: normalized.sourceUrl },
      select: { id: true, price: true },
    });
    
    if (existing) {
      if (existing.price !== normalized.price) {
        await db.priceHistory.create({
          data: { listingId: existing.id, price: existing.price },
        });
      }
      await db.listing.update({
        where: { id: existing.id },
        data: {
          price: normalized.price,
          mileageKm: normalized.mileageKm ?? null,
          fuelType: normalized.fuelType ?? null,
          transmission: normalized.transmission ?? null,
          bodyType: normalized.bodyType ?? null,
          color: normalized.color ?? null,
          city: normalized.city ?? null,
          sellerType: normalized.sellerType ?? null,
          imageUrl: normalized.imageUrl ?? null,
          imageUrls: normalized.imageUrls ? JSON.stringify(normalized.imageUrls) : '[]',
          description: normalized.description ?? null,
          lastSeenAt: new Date(),
          isActive: true,
          isDeleted: false,
        },
      });
      return 'updated';
    } else {
      await db.listing.create({
        data: {
          sourceName: normalized.sourceName,
          sourceUrl: normalized.sourceUrl,
          make: normalized.make,
          model: normalized.model,
          year: normalized.year,
          price: normalized.price,
          currency: normalized.currency,
          mileageKm: normalized.mileageKm ?? null,
          fuelType: normalized.fuelType ?? null,
          transmission: normalized.transmission ?? null,
          bodyType: normalized.bodyType ?? null,
          color: normalized.color ?? null,
          city: normalized.city ?? null,
          sellerType: normalized.sellerType ?? null,
          imageUrl: normalized.imageUrl ?? null,
          imageUrls: normalized.imageUrls ? JSON.stringify(normalized.imageUrls) : '[]',
          description: normalized.description ?? null,
          lastSeenAt: new Date(),
          isActive: true,
          isDeleted: false,
        },
      });
      return 'new';
    }
  } catch {
    return 'error';
  }
}

// ── Process queue with concurrency limit ─────────────────────────────
async function processWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  arabam.com DETAY sayfası scraper');
  console.log('  (Wayback Machine üzerinden — Cloudflare bypass)');
  console.log('  Letgo verisine DOKUNULMAZ');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const t0 = Date.now();
  
  // ── Step 1: Collect listing URLs from CDX API ────
  console.log('📋 Adım 1: Wayback CDX\'ten archived detail URL\'leri alınıyor...');
  const archivedUrls = await getArchivedDetailUrls();
  
  // Limit
  const urls = archivedUrls.slice(0, MAX_DETAILS);
  console.log(`🎯 En fazla ${urls.length} detay sayfası işlenecek\n`);
  
  // ── Step 2: Fetch + parse detail pages ────
  console.log('🔍 Adım 2: Detay sayfaları çekiliyor (concurrency: ' + CONCURRENCY + ')...');
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let progress = 0;
  
  await processWithConcurrency(
    urls,
    async (item) => {
      progress++;
      const html = await fetchDetailPage(item.url, item.timestamp);
      if (!html) {
        errorCount++;
        if (progress % 10 === 0) {
          console.log(`  [${progress}/${urls.length}] Yeni=${newCount} Güncellenen=${updatedCount} Hata=${errorCount}`);
        }
        return;
      }
      
      const listing = parseDetailPage(html, item.url);
      if (!listing) {
        errorCount++;
        return;
      }
      
      const result = await saveListing(listing);
      if (result === 'new') newCount++;
      else if (result === 'updated') updatedCount++;
      else errorCount++;
      
      if (progress % 5 === 0 || progress === urls.length) {
        console.log(`  [${progress}/${urls.length}] Yeni=${newCount} Güncellenen=${updatedCount} Hata=${errorCount} — son: ${listing.make} ${listing.model} ${listing.year}`);
      }
    },
    CONCURRENCY,
  );
  
  const durationMs = Date.now() - t0;
  console.log(`\n✓ Tamamlandı: ${newCount} yeni, ${updatedCount} güncellenen, ${errorCount} hata, ${(durationMs / 1000).toFixed(1)}s`);
  
  // ScrapeLog
  try {
    await db.scrapeLog.create({
      data: {
        sourceName: 'arabam',
        startTime: new Date(t0),
        endTime: new Date(),
        status: newCount > 0 ? 'success' : 'failed',
        itemsFound: urls.length,
        itemsSaved: newCount,
        durationMs,
      },
    });
  } catch {}
  
  // ── Step 3: Valuation + cost estimation ────
  console.log('\n📊 Valuation çalıştırılıyor...');
  try {
    await valueAllListings();
  } catch (e: any) {
    console.error(`  Hata: ${e.message}`);
  }
  console.log('💰 Cost estimation...');
  try {
    await estimateAllCosts();
  } catch (e: any) {
    console.error(`  Hata: ${e.message}`);
  }
  
  // ── Summary ────
  const bySource = await db.listing.groupBy({
    by: ['sourceName'],
    where: { isActive: true },
    _count: true,
  });
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ÖZET');
  console.log('═══════════════════════════════════════════════════════');
  for (const s of bySource) {
    console.log(`  ${s.sourceName}: ${s._count} aktif ilan`);
  }
  
  // Sample with full detail
  const sample = await db.listing.findMany({
    where: { sourceName: 'arabam', isActive: true, description: { not: null } },
    take: 3,
    select: { make: true, model: true, year: true, price: true, mileageKm: true, fuelType: true, transmission: true, bodyType: true, color: true, city: true, sellerType: true, description: true },
  });
  if (sample.length > 0) {
    console.log('\nÖrnek tam dolu ilanlar:');
    for (const s of sample) {
      console.log(`  • ${s.year} ${s.make} ${s.model} — ${s.price.toLocaleString('tr-TR')}₺`);
      console.log(`    km=${s.mileageKm}, fuel=${s.fuelType}, trans=${s.transmission}, body=${s.bodyType}, color=${s.color}, city=${s.city}, seller=${s.sellerType}`);
      if (s.description) console.log(`    desc: ${s.description.substring(0, 100)}...`);
    }
  }
  console.log('═══════════════════════════════════════════════════════');
  
  await db.$disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
