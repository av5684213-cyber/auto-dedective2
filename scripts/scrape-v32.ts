import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { normalizeListing } from '@/lib/services/normalizer';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import type { RawListing } from '@/lib/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const LISTING_PAGES_2026 = [
  'https://web.archive.org/web/20260520182052/https://www.arabam.com/ikinci-el/otomobil',
  'https://web.archive.org/web/20260520182052/https://www.arabam.com/ikinci-el/otomobil?page=2',
  'https://web.archive.org/web/20260413054518/https://www.arabam.com/ikinci-el/otomobil?page=3',
  'https://web.archive.org/web/20260309180028/https://www.arabam.com/ikinci-el/otomobil?page=4',
  'https://web.archive.org/web/20260306131845/https://www.arabam.com/ikinci-el/otomobil?page=5',
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
  if (slug.startsWith(makeLower + '-')) slug = slug.substring(makeLower.length + 1);
  return slug.split('-').filter(Boolean)
    .map(w => /^\d$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ').replace(/(\d)\s+(\d)\b/g, '$1.$2').trim();
}

function parseListingsPage(html: string): { active: RawListing[]; inactive: number } {
  const $ = cheerio.load(html);
  const active: RawListing[] = [];
  const seen = new Set<string>();
  let inactive = 0;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text();
      if (!text.includes('"Vehicle"') && !text.includes('"Car"')) return;
      const parsed = JSON.parse(text);
      const vehicles = Array.isArray(parsed) ? parsed : [parsed];
      
      for (const v of vehicles) {
        if (v['@type'] !== 'Vehicle' && v['@type'] !== 'Car') continue;
        
        // ─── ACTIVITY CHECK: Only keep listings with availability = InStock ───
        const availability = v.offers?.availability || '';
        const isInStock = availability.includes('InStock');
        if (!isInStock) {
          inactive++;
          continue;
        }
        
        // URL
        let url: string = v.url || '';
        if (!url) continue;
        const m = url.match(/\/web\/\d+\/(https?:\/\/.+)/);
        if (m) url = m[1];
        if (!url.startsWith('http')) url = `https://www.arabam.com${url.startsWith('/') ? '' : '/'}${url}`;
        if (seen.has(url)) continue;
        
        // Make
        const make = normalizeMake(String(v.manufacturer || v.brand?.name || ''));
        if (!make) continue;
        
        const model = extractModelFromUrl(url, make);
        const year = parseInt(String(v.productionDate || v.vehicleModelDate || '0').match(/\d{4}/)?.[0] || '0');
        const mileageKm = v.mileageFromOdometer?.value ? parseInt(String(v.mileageFromOdometer.value)) : undefined;
        const fuelType = v.vehicleEngine?.fuelType ? normalizeFuel(String(v.vehicleEngine.fuelType)) : undefined;
        const transmission = v.vehicleTransmission ? normalizeTransmission(String(v.vehicleTransmission)) : undefined;
        const price = v.offers?.price ? parseInt(String(v.offers.price).replace(/[^\d]/g, '')) : 0;
        if (!price) continue;
        
        // Image
        let imageUrl: string | undefined;
        if (v.image) {
          const imgStr = Array.isArray(v.image) ? v.image[0] : v.image;
          if (typeof imgStr === 'string') {
            const imgM = imgStr.match(/\/web\/\d+(?:im_)?\/(https?:\/\/.+)/);
            imageUrl = imgM ? imgM[1] : (imgStr.startsWith('http') ? imgStr : undefined);
          }
        }
        
        seen.add(url);
        active.push({
          sourceName: 'arabam',
          sourceUrl: url,
          make, model, year, price, currency: 'TRY',
          mileageKm, fuelType, transmission,
          color: v.color || undefined,
          imageUrl,
          imageUrls: imageUrl ? [imageUrl] : [],
          description: v.name ? String(v.name).trim() : undefined,
        });
      }
    } catch {}
  });

  return { active, inactive };
}

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 30000, validateStatus: () => true, maxRedirects: 5,
    });
    if (res.status === 200 && res.data.length > 50000) return res.data;
  } catch {}
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
  console.log('  arabam.com v3.2 — Sadece AKTİF (InStock) ilanlar');
  console.log('  JSON-LD availability alanına göre filtreleme');
  console.log('  Letgo verisine DOKUNULMAZ');
  console.log('═══════════════════════════════════════════════════════\n');

  // First, delete all existing arabam listings (clean slate)
  console.log('🧹 Mevcut arabam ilanları siliniyor...');
  const deleted = await db.listing.deleteMany({ where: { sourceName: 'arabam' } });
  console.log(`  ✓ ${deleted.count} eski ilan silindi\n`);

  const t0 = Date.now();
  const allListings: RawListing[] = [];
  const seenUrls = new Set<string>();
  let totalInactive = 0;

  for (const pageUrl of LISTING_PAGES_2026) {
    console.log(`📄 ${pageUrl.substring(50, 100)}...`);
    const html = await fetchPage(pageUrl);
    if (!html) { console.log('  ✗ Failed'); continue; }
    
    const { active, inactive } = parseListingsPage(html);
    totalInactive += inactive;
    let newCount = 0;
    for (const l of active) {
      if (!seenUrls.has(l.sourceUrl)) {
        seenUrls.add(l.sourceUrl);
        allListings.push(l);
        newCount++;
      }
    }
    console.log(`  ✓ ${active.length} aktif, ${inactive} pasif, ${newCount} yeni (toplam aktif: ${allListings.length})`);
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n📦 Toplam ${allListings.length} aktif ilan, ${totalInactive} pasif ilan es geçildi`);

  console.log('\n💾 Kaydediliyor...');
  const { saved, updated } = await saveListings(allListings);
  console.log(`✓ ${saved} yeni, ${updated} güncellendi`);

  // ScrapeLog
  try {
    await db.scrapeLog.create({
      data: {
        sourceName: 'arabam', startTime: new Date(t0), endTime: new Date(),
        status: 'success', itemsFound: allListings.length, itemsSaved: saved,
        durationMs: Date.now() - t0,
      },
    });
  } catch {}

  console.log('\n📊 Valuation + Cost estimation...');
  try { await valueAllListings(); } catch {}
  try { await estimateAllCosts(); } catch {}

  const bySource = await db.listing.groupBy({ by: ['sourceName'], where: { isActive: true }, _count: true });
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ÖZET');
  console.log('═══════════════════════════════════════════════════════');
  for (const s of bySource) console.log(`  ${s.sourceName}: ${s._count} aktif ilan`);
  console.log(`  Toplam pasif (es geçilen): ${totalInactive}`);

  // Sample
  const sample = await db.listing.findMany({
    where: { sourceName: 'arabam', isActive: true },
    take: 5,
    select: { make: true, model: true, year: true, price: true, mileageKm: true, fuelType: true, transmission: true, sourceUrl: true },
  });
  console.log('\nÖrnek aktif ilanlar:');
  for (const l of sample) {
    console.log(`  • ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺ — ${l.mileageKm}km — ${l.fuelType}/${l.transmission}`);
    console.log(`    URL: ${l.sourceUrl.substring(0, 100)}...`);
  }
  console.log('═══════════════════════════════════════════════════════');

  await db.$disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
