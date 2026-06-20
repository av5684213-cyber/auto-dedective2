import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { normalizeListing } from '@/lib/services/normalizer';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import type { RawListing } from '@/lib/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// 2026 listing page snapshots — URLs from these are CURRENT (May 2026)
const LISTING_PAGES_2026 = [
  'https://web.archive.org/web/20260520182052/https://www.arabam.com/ikinci-el/otomobil',
  'https://web.archive.org/web/20260520182052/https://www.arabam.com/ikinci-el/otomobil?page=2',
  'https://web.archive.org/web/20260413054518/https://www.arabam.com/ikinci-el/otomobil?page=3',
  'https://web.archive.org/web/20260309180028/https://www.arabam.com/ikinci-el/otomobil?page=4',
  'https://web.archive.org/web/20260306131845/https://www.arabam.com/ikinci-el/otomobil?page=5',
  'https://web.archive.org/web/20260204101703/https://www.arabam.com/ikinci-el/otomobil?page=6',
  'https://web.archive.org/web/20260130143527/https://www.arabam.com/ikinci-el/otomobil?page=7',
];

const MAKES_NORMALIZE: Record<string, string> = {
  'bmw': 'BMW', 'mercedes-benz': 'Mercedes-Benz', 'mercedes': 'Mercedes-Benz',
  'volkswagen': 'Volkswagen', 'vw': 'Volkswagen',
  'audi': 'Audi', 'toyota': 'Toyota', 'honda': 'Honda',
  'hyundai': 'Hyundai', 'renault': 'Renault', 'fiat': 'Fiat',
  'ford': 'Ford', 'opel': 'Opel', 'peugeot': 'Peugeot',
  'citroen': 'Citroen', 'skoda': 'Skoda', 'seat': 'Seat',
  'kia': 'Kia', 'nissan': 'Nissan', 'mazda': 'Mazda',
  'volvo': 'Volvo', 'mitsubishi': 'Mitsubishi', 'dacia': 'Dacia',
  'chevrolet': 'Chevrolet', 'chery': 'Chery', 'jeep': 'Jeep',
  'lexus': 'Lexus', 'mini': 'Mini', 'subaru': 'Subaru',
  'suzuki': 'Suzuki', 'alfa-romeo': 'Alfa Romeo',
  'land rover': 'Land Rover', 'porsche': 'Porsche',
  'togg': 'Togg', 'tesla': 'Tesla',
};

function normalizeMake(make: string): string {
  return MAKES_NORMALIZE[make.toLowerCase().trim()] || make.trim();
}

function normalizeFuel(fuel: string): string | undefined {
  if (!fuel) return undefined;
  const f = fuel.toLowerCase().trim();
  if (f === 'benzin') return 'Benzin';
  if (f === 'dizel') return 'Dizel';
  if (f === 'lpg' || f === 'lpg & benzin' || f === 'benzin & lpg') return 'Benzin + LPG';
  if (f === 'hybrid' || f === 'hibrit') return 'Hybrid';
  if (f === 'elektrik' || f === 'electric') return 'Elektrik';
  return fuel;
}

function normalizeTransmission(trans: string): string | undefined {
  if (!trans) return undefined;
  const t = trans.toLowerCase().trim();
  if (t === 'düz' || t === 'manuel') return 'Manuel';
  if (t === 'otomatik' || t === 'automatic') return 'Otomatik';
  if (t === 'yarı otomatik' || t === 'yari otomatik') return 'Yarı Otomatik';
  return trans;
}

function extractModelFromUrl(url: string, make: string): string {
  const m = url.match(/\/ilan\/(?:galeriden|sahibinden)-satilik-([^/]+)/);
  if (!m) return '';
  let slug = m[1];
  const makeLower = make.toLowerCase().replace(/\s+/g, '-');
  if (slug.startsWith(makeLower + '-')) {
    slug = slug.substring(makeLower.length + 1);
  } else if (slug.startsWith(makeLower)) {
    slug = slug.substring(makeLower.length);
  }
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => /^\d$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/(\d)\s+(\d)\b/g, '$1.$2')
    .trim();
}

function parseListingsPage(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const listings: RawListing[] = [];
  const seen = new Set<string>();

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text();
      if (!text.includes('"Vehicle"') && !text.includes('"Car"')) return;
      const parsed = JSON.parse(text);
      const vehicles = Array.isArray(parsed) ? parsed : [parsed];
      
      for (const v of vehicles) {
        if (v['@type'] !== 'Vehicle' && v['@type'] !== 'Car') continue;
        
        // URL — strip Wayback prefix to get clean arabam.com URL
        let url: string = v.url || '';
        if (!url) continue;
        const m = url.match(/\/web\/\d+\/(https?:\/\/.+)/);
        if (m) url = m[1];
        if (!url.startsWith('http')) url = `https://www.arabam.com${url.startsWith('/') ? '' : '/'}${url}`;
        if (seen.has(url)) continue;
        
        // Make
        const manufacturer = v.manufacturer || (v.brand && v.brand.name) || '';
        const make = normalizeMake(String(manufacturer));
        if (!make) continue;
        
        // Model from URL slug
        const model = extractModelFromUrl(url, make);
        
        // Year
        const year = parseInt(String(v.productionDate || v.vehicleModelDate || '0').match(/\d{4}/)?.[0] || '0');
        
        // KM
        const mileage = v.mileageFromOdometer;
        const mileageKm = mileage?.value ? parseInt(String(mileage.value)) : undefined;
        
        // Fuel
        const fuelType = v.vehicleEngine?.fuelType ? normalizeFuel(String(v.vehicleEngine.fuelType)) : undefined;
        
        // Transmission
        const transmission = v.vehicleTransmission ? normalizeTransmission(String(v.vehicleTransmission)) : undefined;
        
        // Price
        const price = v.offers?.price ? parseInt(String(v.offers.price).replace(/[^\d]/g, '')) : 0;
        if (!price) continue;
        
        // Image — strip Wayback prefix
        let imageUrl: string | undefined;
        if (v.image) {
          const imgStr = Array.isArray(v.image) ? v.image[0] : v.image;
          if (typeof imgStr === 'string') {
            const imgM = imgStr.match(/\/web\/\d+(?:im_)?\/(https?:\/\/.+)/);
            imageUrl = imgM ? imgM[1] : (imgStr.startsWith('http') ? imgStr : undefined);
          }
        }
        
        // Name/title
        const name = v.name ? String(v.name).trim() : '';
        
        seen.add(url);
        listings.push({
          sourceName: 'arabam',
          sourceUrl: url,
          make,
          model,
          year,
          price,
          currency: 'TRY',
          mileageKm,
          fuelType,
          transmission,
          color: v.color || undefined,
          imageUrl,
          imageUrls: imageUrl ? [imageUrl] : [],
          description: name,
        });
      }
    } catch {}
  });

  return listings;
}

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 30000,
      validateStatus: () => true,
      maxRedirects: 5,
    });
    if (res.status === 200 && res.data.length > 50000) return res.data;
    console.log(`  ⚠️ HTTP ${res.status}, len ${res.data?.length || 0}`);
  } catch (e: any) {
    console.log(`  ⚠️ ${e.message.substring(0, 80)}`);
  }
  return '';
}

async function saveListings(raws: RawListing[]): Promise<{ saved: number; updated: number }> {
  let saved = 0, updated = 0;
  for (const raw of raws) {
    try {
      const normalized = normalizeListing(raw) as any;
      if (!normalized.sourceUrl || !normalized.make) continue;
      
      const existing = await db.listing.findUnique({
        where: { sourceUrl: normalized.sourceUrl },
        select: { id: true, price: true },
      });
      
      if (existing) {
        if (existing.price !== normalized.price) {
          await db.priceHistory.create({ data: { listingId: existing.id, price: existing.price } });
        }
        await db.listing.update({
          where: { id: existing.id },
          data: {
            price: normalized.price, mileageKm: normalized.mileageKm ?? null,
            fuelType: normalized.fuelType ?? null, transmission: normalized.transmission ?? null,
            color: normalized.color ?? null, imageUrl: normalized.imageUrl ?? null,
            description: normalized.description ?? null,
            lastSeenAt: new Date(), isActive: true, isDeleted: false,
          },
        });
        updated++;
      } else {
        await db.listing.create({
          data: {
            sourceName: normalized.sourceName, sourceUrl: normalized.sourceUrl,
            make: normalized.make, model: normalized.model, year: normalized.year,
            price: normalized.price, currency: normalized.currency,
            mileageKm: normalized.mileageKm ?? null, fuelType: normalized.fuelType ?? null,
            transmission: normalized.transmission ?? null, color: normalized.color ?? null,
            imageUrl: normalized.imageUrl ?? null,
            imageUrls: normalized.imageUrls ? JSON.stringify(normalized.imageUrls) : '[]',
            description: normalized.description ?? null,
            lastSeenAt: new Date(), isActive: true, isDeleted: false,
          },
        });
        saved++;
      }
    } catch {}
  }
  return { saved, updated };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  arabam.com 2026 listing scraper (CURRENT URLs)');
  console.log('  Letgo verisine DOKUNULMAZ');
  console.log('═══════════════════════════════════════════════════════\n');

  const t0 = Date.now();
  const allListings: RawListing[] = [];
  const seenUrls = new Set<string>();

  for (const pageUrl of LISTING_PAGES_2026) {
    console.log(`📄 ${pageUrl.substring(50, 100)}...`);
    const html = await fetchPage(pageUrl);
    if (!html) continue;
    
    const listings = parseListingsPage(html);
    let newCount = 0;
    for (const l of listings) {
      if (!seenUrls.has(l.sourceUrl)) {
        seenUrls.add(l.sourceUrl);
        allListings.push(l);
        newCount++;
      }
    }
    console.log(`  ✓ ${listings.length} parsed, ${newCount} new (total: ${allListings.length})`);
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n📦 Total unique: ${allListings.length}`);

  // Show samples
  console.log('\nSample listings:');
  for (const l of allListings.slice(0, 5)) {
    console.log(`  • ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺ — ${l.mileageKm}km — ${l.fuelType}/${l.transmission}`);
    console.log(`    URL: ${l.sourceUrl}`);
  }

  console.log('\n💾 Saving to DB...');
  const { saved, updated } = await saveListings(allListings);
  console.log(`✓ Saved: ${saved} new, ${updated} updated`);

  // ScrapeLog
  try {
    await db.scrapeLog.create({
      data: {
        sourceName: 'arabam', startTime: new Date(t0), endTime: new Date(),
        status: allListings.length > 0 ? 'success' : 'failed',
        itemsFound: allListings.length, itemsSaved: saved, durationMs: Date.now() - t0,
      },
    });
  } catch {}

  console.log('\n📊 Valuation...');
  try { await valueAllListings(); } catch {}
  console.log('💰 Cost estimation...');
  try { await estimateAllCosts(); } catch {}

  const bySource = await db.listing.groupBy({ by: ['sourceName'], where: { isActive: true }, _count: true });
  console.log('\n═══════════════════════════════════════════════════════');
  for (const s of bySource) console.log(`  ${s.sourceName}: ${s._count} aktif ilan`);
  console.log('═══════════════════════════════════════════════════════');

  await db.$disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
