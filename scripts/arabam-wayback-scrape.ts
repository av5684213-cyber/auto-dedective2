#!/usr/bin/env bun
/**
 * Real arabam.com scraper — uses Wayback Machine to bypass Cloudflare.
 *
 * Earlier version only extracted title+price from <a> tags, missing year/km/color/etc.
 * This version parses the JSON-LD structured data embedded in the listing page HTML,
 * which contains all the detail fields: manufacturer, model, mileage, fuel, transmission, etc.
 *
 * Letgo verisine DOKUNMAZ — UPSERT anahtarı sourceUrl.
 *
 * Usage:
 *   bun run scripts/arabam-wayback-scrape.ts
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { normalizeListing } from '@/lib/services/normalizer';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import type { RawListing } from '@/lib/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Multiple listing pages (search results) — each returns ~20 unique listings
const LISTING_PAGES = [
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=2',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=3',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=4',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=5',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=6',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=7',
];

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

/** Extract model name from arabam URL slug.
 *  URL format: /ilan/{galeriden|sahibinden}-satilik-{make}-{model-slug}/{dealer-or-seller}/{id}
 *  Example: /ilan/galeriden-satilik-bmw-5-serisi-520d-m-sport/atik-motors-.../27277069
 *  → make="bmw", model="5 Serisi 520d M Sport"
 */
function extractModelFromUrl(url: string, make: string): string {
  try {
    const m = url.match(/\/ilan\/(?:galeriden|sahibinden)-satilik-([^/]+)/);
    if (!m) return '';
    let slug = m[1];
    // Remove make prefix — normalize make to slug form: "Mercedes - Benz" → "mercedes-benz"
    const makeLower = make.toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
    if (slug.startsWith(makeLower + '-')) {
      slug = slug.substring(makeLower.length + 1);
    } else if (slug.startsWith(makeLower)) {
      slug = slug.substring(makeLower.length);
    }
    // Convert slug to readable form: "5-serisi-520d-m-sport" → "5 Serisi 520d M Sport"
    // Special: "1-6" → "1.6" (engine displacement convention)
    return slug
      .split('-')
      .filter(Boolean)
      .map(word => {
        // Convert "1-6" pattern → "1.6" (engine displacement like 1.6, 2.0, 3.5)
        if (/^\d$/.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ')
      .replace(/(\d)\s+(\d)\b/g, '$1.$2')  // "1 6" → "1.6"
      .trim();
  } catch {
    return '';
  }
}

const TRANSMISSION_NORMALIZE: Record<string, string> = {
  'manuel': 'Manuel', 'manual': 'Manuel',
  'otomatik': 'Otomatik', 'automatic': 'Otomatik',
  'yarı otomatik': 'Yarı Otomatik', 'yari otomatik': 'Yarı Otomatik',
  'semi-automatic': 'Yarı Otomatik',
  'dsg': 'Yarı Otomatik', 'edc': 'Yarı Otomatik', 'tiptronic': 'Yarı Otomatik',
};

function normalizeTransmission(trans: string): string | undefined {
  if (!trans) return undefined;
  return TRANSMISSION_NORMALIZE[trans.toLowerCase().trim()] || trans;
}

function parseColor(color: string): string | undefined {
  if (!color) return undefined;
  const tr: Record<string, string> = {
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
  };
  return tr[color.toLowerCase().trim()] || color;
}

/** Parse a single listing page (search results) and extract all listings with full detail */
function parseListings(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const listings: RawListing[] = [];
  const seen = new Set<string>();

  // Find all JSON-LD blocks with Vehicle type
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text();
      if (!text.includes('"Vehicle"') && !text.includes('"Car"')) return;
      
      const parsed = JSON.parse(text);
      const vehicles = Array.isArray(parsed) ? parsed : [parsed];
      
      for (const v of vehicles) {
        if (v['@type'] !== 'Vehicle' && v['@type'] !== 'Car') continue;
        
        // Extract URL
        let url: string = v.url || '';
        if (!url) continue;
        // Strip wayback prefix if present
        const m = url.match(/\/web\/\d+\/(https?:\/\/.+)/);
        if (m) url = m[1];
        if (!url.startsWith('http')) {
          url = `https://www.arabam.com${url.startsWith('/') ? '' : '/'}${url}`;
        }
        if (seen.has(url)) continue;
        seen.add(url);

        // Extract fields from JSON-LD
        const manufacturer = v.manufacturer || (v.brand && v.brand.name) || '';
        const manufacturerName = typeof manufacturer === 'object' ? manufacturer.name : manufacturer;
        const make = normalizeMake(String(manufacturerName || ''));
        
        // Model is NOT in JSON-LD directly, extract from URL slug
        const model = extractModelFromUrl(url, make);
        
        const productionDate = v.productionDate || v.vehicleModelDate || '';
        const year = productionDate ? parseInt(String(productionDate).match(/\d{4}/)?.[0] || '0') : 0;
        
        const mileage = v.mileageFromOdometer;
        const mileageKm = mileage && typeof mileage === 'object'
          ? parseInt(String(mileage.value || '0')) || undefined
          : mileage ? parseInt(String(mileage)) || undefined : undefined;
        
        // fuelType is inside vehicleEngine.fuelType
        const vehicleEngine = v.vehicleEngine;
        const fuelTypeRaw = vehicleEngine && typeof vehicleEngine === 'object'
          ? vehicleEngine.fuelType : undefined;
        const fuelType = fuelTypeRaw ? normalizeFuel(String(fuelTypeRaw)) : undefined;
        
        const vehicleTransmission = v.vehicleTransmission
          ? normalizeTransmission(String(v.vehicleTransmission)) : undefined;
        const color = v.color ? parseColor(String(v.color)) : undefined;
        
        // driveWheelConfiguration gives body type hint (Arkadan İtiş, Önden Çekiş, 4x4)
        const driveWheel = v.driveWheelConfiguration ? String(v.driveWheelConfiguration) : undefined;
        
        // Offer (price)
        const offers = v.offers;
        let price = 0;
        if (offers) {
          const priceStr = offers.price || '';
          price = parseInt(String(priceStr).replace(/[^\d]/g, '')) || 0;
        }
        
        // Skip if no make or no price
        if (!make || price === 0) continue;
        
        // Build description from available fields
        const descParts: string[] = [];
        if (year) descParts.push(`${year} model`);
        if (mileageKm) descParts.push(`${mileageKm.toLocaleString('tr-TR')} km`);
        if (color) descParts.push(`${color} renk`);
        if (fuelType) descParts.push(fuelType);
        if (vehicleTransmission) descParts.push(vehicleTransmission);
        if (driveWheel) descParts.push(driveWheel);
        // Also include the original listing name from JSON-LD
        const originalName = v.name ? String(v.name) : '';
        if (originalName) descParts.push(`(${originalName})`);
        const description = descParts.join(', ');
        
        // Image
        const image = v.image ? (Array.isArray(v.image) ? v.image[0] : v.image) : '';
        let imageUrl: string | undefined;
        if (image && typeof image === 'string') {
          if (image.startsWith('http')) {
            // Strip wayback prefix
            const imgMatch = image.match(/\/web\/\d+(?:im_)?\/(https?:\/\/.+)/);
            imageUrl = imgMatch ? imgMatch[1] : image;
          }
        }
        
        listings.push({
          sourceName: 'arabam',
          sourceUrl: url,
          make,
          model: String(model || ''),
          year,
          price,
          currency: 'TRY',
          mileageKm,
          fuelType,
          transmission: vehicleTransmission,
          bodyType: v.bodyType || undefined,
          color,
          city: undefined,
          imageUrl,
          imageUrls: imageUrl ? [imageUrl] : [],
          description,
        });
      }
    } catch {
      // Skip malformed JSON-LD
    }
  });

  // Fallback: parse from <a> tags' grandparent text (has Year KM Color Price City)
  // This catches listings not in JSON-LD
  $('a[href*="/ilan/"]').each((_, el) => {
    try {
      const $el = $(el);
      const archiveHref = $el.attr('href') || '';
      const m = archiveHref.match(/\/web\/\d+\/(https?:\/\/[^"'\s]+\/ilan\/[^"'\s]+\/\d+)/);
      if (!m) return;
      const url = m[1];
      if (seen.has(url)) return;

      // Look at grandparent text — it contains: "TITLE DESC YEAR KM COLOR PRICE TL DATE CITY DISTRICT ..."
      const grandparentText = $el.parent().parent().text().replace(/\s+/g, ' ').trim();
      if (!grandparentText) return;

      // Skip if URL doesn't match galeriden/sahibinden-satilik pattern (likely not a real car listing)
      const slugMatch = url.match(/\/(galeriden|sahibinden)-satilik-([^/]+)/);
      if (!slugMatch) return;

      // Extract make from URL slug by checking known makes
      const fullSlug = slugMatch[2]; // e.g., "bmw-5-serisi-520d-m-sport"
      let make = '';
      let modelSlug = fullSlug;
      for (const makeKey of Object.keys(MAKES_NORMALIZE)) {
        if (fullSlug.startsWith(makeKey + '-')) {
          make = MAKES_NORMALIZE[makeKey];
          modelSlug = fullSlug.substring(makeKey.length + 1);
          break;
        }
      }
      if (!make) return; // skip unknown makes (likely not real car listings)

      // Convert model slug to readable form
      const model = modelSlug
        .split('-')
        .filter(Boolean)
        .map(word => {
          if (/^\d$/.test(word)) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ')
        .replace(/(\d)\s+(\d)\b/g, '$1.$2')
        .trim();

      // Extract price (last "X.XXX TL" before date)
      const priceMatch = grandparentText.match(/([0-9]{1,3}(\.[0-9]{3})+)\s*TL/);
      if (!priceMatch) return;
      const price = parseInt(priceMatch[1].replace(/\./g, ''));
      if (price === 0) return;

      // Extract year (4-digit number)
      const yearMatch = grandparentText.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0]) : 0;

      // Extract KM (X.XXX before "km" or just a number near "km")
      const kmMatch = grandparentText.match(/(\d{1,3}(\.\d{3})*)\s*(?:km|KM)/);
      const mileageKm = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : undefined;

      // Extract color (Turkish color words)
      const colorMatch = grandparentText.match(/\b(Beyaz|Siyah|Gri|Kırmızı|Kirmizi|Mavi|Yeşil|Yesil|Gümüş|Gumus|Sarı|Sari|Turuncu|Kahverengi|Mor|Bej|Bordo|Lacivert)\b/);
      const color = colorMatch ? parseColor(colorMatch[1]) : undefined;

      // Extract city (Turkish cities)
      const cityMatch = grandparentText.match(/\b(İstanbul|Ankara|İzmir|Bursa|Antalya|Adana|Konya|Gaziantep|Mersin|Kayseri|Eskişehir|Samsun|Denizli|Trabzon|Muğla|Aydın|Balıkesir|Sakarya|Kocaeli|Tekirdağ|Hatay|Manisa|Şanlıurfa|Diyarbakır|Malatya|Erzurum|Zonguldak|Kahramanmaraş|Van|Bolu|Düzce|Kütahya|Afyon|Isparta|Edirne|Aydın)\b/);
      const city = cityMatch ? cityMatch[1] : undefined;

      // Extract district (after city name)
      const districtMatch = grandparentText.match(/(?:İstanbul|Ankara|İzmir|Bursa|Antalya|Adana|Konya|Gaziantep|Mersin|Kayseri|Eskişehir|Samsun|Denizli|Trabzon|Muğla|Aydın|Balıkesir|Sakarya|Kocaeli|Tekirdağ|Hatay|Manisa|Şanlıurfa|Diyarbakır|Malatya|Erzurum|Zonguldak|Kahramanmaraş|Van|Bolu|Düzce|Kütahya|Afyon|Isparta|Edirne)\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)/);
      const district = districtMatch ? districtMatch[1] : undefined;

      // Description from grandparent text (truncated)
      const description = grandparentText.substring(0, 500);

      // Image — look for img in the parent
      const imgEl = $el.parent().parent().find('img').first();
      let imageUrl: string | undefined;
      if (imgEl.length) {
        const src = imgEl.attr('src') || imgEl.attr('data-src') || '';
        if (src) {
          const imgM = src.match(/\/web\/\d+(?:im_)?\/(https?:\/\/.+)/);
          imageUrl = imgM ? imgM[1] : (src.startsWith('http') ? src : undefined);
        }
      }

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
        fuelType: undefined, // not in <a> tag grandparent
        transmission: undefined,
        bodyType: undefined,
        color,
        city,
        district,
        imageUrl,
        imageUrls: imageUrl ? [imageUrl] : [],
        description,
      });
    } catch {}
  });

  return listings;
}

async function fetchPage(url: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
        timeout: 45000,
        validateStatus: () => true,
        maxRedirects: 5,
      });
      if (res.status === 200 && res.data.length > 50000) {
        return res.data;
      }
      console.log(`  ⚠️ Attempt ${attempt + 1}: HTTP ${res.status}, len ${res.data?.length || 0}`);
    } catch (e: any) {
      console.log(`  ⚠️ Attempt ${attempt + 1}: ${e.message.substring(0, 80)}`);
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 5000));
  }
  return '';
}

async function saveListings(raws: RawListing[]): Promise<{ saved: number; updated: number }> {
  let saved = 0;
  let updated = 0;
  const seen = new Set<string>();
  for (const raw of raws) {
    if (seen.has(raw.sourceUrl)) continue;
    seen.add(raw.sourceUrl);
    try {
      const normalized = normalizeListing(raw) as any;
      if (!normalized.sourceUrl || !normalized.make) continue;

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
            district: normalized.district ?? null,
            imageUrl: normalized.imageUrl ?? null,
            imageUrls: normalized.imageUrls ? JSON.stringify(normalized.imageUrls) : '[]',
            description: normalized.description ?? null,
            lastSeenAt: new Date(),
            isActive: true,
            isDeleted: false,
          },
        });
        updated++;
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
            district: normalized.district ?? null,
            imageUrl: normalized.imageUrl ?? null,
            imageUrls: normalized.imageUrls ? JSON.stringify(normalized.imageUrls) : '[]',
            description: normalized.description ?? null,
            lastSeenAt: new Date(),
            isActive: true,
            isDeleted: false,
          },
        });
        saved++;
      }
    } catch (e: any) {
      // silent
    }
  }
  return { saved, updated };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  arabam.com Wayback Scraper — REAL listings with full detail');
  console.log('  Letgo verisine DOKUNULMAZ');
  console.log('═══════════════════════════════════════════════════════\n');

  const t0 = Date.now();
  const allListings: RawListing[] = [];
  const seenUrls = new Set<string>();

  for (const pageUrl of LISTING_PAGES) {
    console.log(`📄 Fetching: ${pageUrl.substring(70)}...`);
    const html = await fetchPage(pageUrl);
    if (!html) {
      console.log('  ✗ Failed');
      continue;
    }
    const listings = parseListings(html);
    // Dedup
    let newCount = 0;
    for (const l of listings) {
      if (!seenUrls.has(l.sourceUrl)) {
        seenUrls.add(l.sourceUrl);
        allListings.push(l);
        newCount++;
      }
    }
    console.log(`  ✓ ${listings.length} parsed, ${newCount} new (total: ${allListings.length})`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n📦 Total unique listings: ${allListings.length}`);

  // Show sample
  if (allListings.length > 0) {
    console.log('\nSample listings:');
    for (const l of allListings.slice(0, 5)) {
      console.log(`  • ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺`);
      console.log(`    km=${l.mileageKm}, fuel=${l.fuelType}, trans=${l.transmission}, color=${l.color}, city=${l.city}`);
      console.log(`    ${l.description?.substring(0, 100) || '-'}`);
    }
  }

  // Save to DB
  console.log('\n💾 Saving to DB...');
  const { saved, updated } = await saveListings(allListings);
  console.log(`✓ Saved: ${saved} new, ${updated} updated`);

  // ScrapeLog
  try {
    await db.scrapeLog.create({
      data: {
        sourceName: 'arabam',
        startTime: new Date(t0),
        endTime: new Date(),
        status: allListings.length > 0 ? 'success' : 'failed',
        itemsFound: allListings.length,
        itemsSaved: saved,
        durationMs: Date.now() - t0,
      },
    });
  } catch {}

  // Valuation + cost estimation
  console.log('\n📊 Valuation...');
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

  // Summary
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
  console.log('═══════════════════════════════════════════════════════');

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
