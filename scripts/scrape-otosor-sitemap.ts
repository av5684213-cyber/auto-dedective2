// Otodedektif - Otosor sitemap-based bulk scraper
//
// Otosor.com.tr's /araclar?page=N doesn't paginate (returns same 8 listings).
// But sitemap2.xml contains ~3100 listing URLs. Use that instead.
//
// Usage: npx tsx scripts/scrape-otosor-sitemap.ts [max]

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ListingRaw } from '../src/lib/adapters/base';

const BASE_URL = 'https://www.otosor.com.tr';
const UA = 'OtodedektifBot/1.0 (+https://otodedektif.vercel.app)';
const HTTP_TIMEOUT = 15000;
const MAX_PARALLEL = 6;

const KNOWN_MAKES = ['bmw','mercedes','mercedes-benz','audi','volkswagen','vw','toyota','honda','hyundai','ford','renault','fiat','peugeot','opel','citroen','volvo','mazda','nissan','kia','skoda','seat','suzuki','mitsubishi','chevrolet','jeep','lexus','infiniti','dacia','tofas','chery','alfa-romeo','mini','land-rover','range-rover'];
const MAKE_MAP: Record<string,string> = {'vw':'Volkswagen','mercedes':'Mercedes-Benz','mercedes-benz':'Mercedes-Benz','bmw':'BMW','audi':'Audi','toyota':'Toyota','honda':'Honda','hyundai':'Hyundai','ford':'Ford','renault':'Renault','fiat':'Fiat','peugeot':'Peugeot','opel':'Opel','citroen':'Citroen','volvo':'Volvo','mazda':'Mazda','nissan':'Nissan','kia':'Kia','skoda':'Skoda','seat':'Seat','suzuki':'Suzuki','mitsubishi':'Mitsubishi','chevrolet':'Chevrolet','jeep':'Jeep','lexus':'Lexus','infiniti':'Infiniti','dacia':'Dacia','tofas':'Tofaş','chery':'Chery','alfa-romeo':'Alfa Romeo','mini':'Mini','land-rover':'Land Rover','range-rover':'Land Rover'};
const FUEL_MAP: Record<string,string> = {'benzin':'Benzin','dizel':'Dizel','lpg':'Benzin + LPG','elektrik':'Elektrik','hibrit':'Hybrid','hybrid':'Hybrid'};
const TRANS_MAP: Record<string,string> = {'manuel':'Manuel','otomatik':'Otomatik','yarı-otomatik':'Yarı Otomatik','yari-otomatik':'Yarı Otomatik','dsg':'Yarı Otomatik','cvt':'Yarı Otomatik','powershift':'Yarı Otomatik','edc':'Yarı Otomatik','eat8':'Otomatik','eat6':'Otomatik','at8':'Otomatik'};
const PRICE_RE = /"price"\s*:\s*"?(\d{5,})"?/;

function parseSlug(url: string) {
  const match = url.match(/\/ilan\/(.+)-(\d+)$/);
  if (!match) return null;
  const slug = match[1];
  const parts = slug.split('-');
  let makeIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (KNOWN_MAKES.includes(parts[i].toLowerCase())) { makeIdx = i; break; }
  }
  if (makeIdx === -1) return null;
  const make = MAKE_MAP[parts[makeIdx].toLowerCase()] ?? parts[makeIdx];
  let year = 0, yearIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    const y = parseInt(parts[i], 10);
    if (y >= 1990 && y <= 2030) { year = y; yearIdx = i; break; }
  }
  if (!year) return null;
  let fuelType: string | undefined, fuelIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (FUEL_MAP[parts[i].toLowerCase()]) { fuelType = FUEL_MAP[parts[i].toLowerCase()]; fuelIdx = i; break; }
  }
  let transmission: string | undefined, transIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (TRANS_MAP[parts[i].toLowerCase()]) { transmission = TRANS_MAP[parts[i].toLowerCase()]; transIdx = i; break; }
  }
  let hpIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].endsWith('hp')) { hpIdx = i; break; }
  }
  const keywordStart = Math.min(
    hpIdx >= 0 ? hpIdx : Infinity,
    fuelIdx >= 0 ? fuelIdx : Infinity,
    transIdx >= 0 ? transIdx : Infinity,
    yearIdx >= 0 ? yearIdx : Infinity,
  );
  const modelParts = parts.slice(makeIdx + 1, keywordStart === Infinity ? parts.length : keywordStart);
  return { make, model: modelParts.join(' ').trim() || 'Bilinmiyor', year, fuelType, transmission };
}

async function fetchSitemapUrls(): Promise<string[]> {
  // Try sitemap2.xml first (it has the listings, ~3100 URLs)
  const smUrls = ['sitemap2.xml', 'sitemap3.xml', 'sitemap1.xml'];
  const all: string[] = [];
  for (const sm of smUrls) {
    try {
      const res = await axios.get(`${BASE_URL}/${sm}`, {
        timeout: HTTP_TIMEOUT,
        headers: { 'User-Agent': UA },
      });
      const $ = cheerio.load(res.data, { xml: true });
      $('loc').each((_, el) => {
        const u = $(el).text().trim();
        if (u.includes('/ilan/')) all.push(u);
      });
      console.log(`[otosor-sitemap] ${sm}: ${all.length} URLs so far`);
    } catch (err) {
      console.warn(`[otosor-sitemap] ${sm} failed:`, (err as Error).message);
    }
  }
  return all;
}

async function fetchOne(url: string, slug: ReturnType<typeof parseSlug>): Promise<ListingRaw | null> {
  if (!slug) return null;
  try {
    const res = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      maxRedirects: 5,
    });
    const html = res.data as string;
    const priceMatch = html.match(PRICE_RE);
    if (!priceMatch) return null;
    const price = parseInt(priceMatch[1].replace(/\./g, ''), 10);
    if (!price || price < 10000) return null;
    const imgMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
    const imageUrl = imgMatch?.[1];
    let city: string | undefined;
    const cityMatch = html.match(/class="[^"]*location[^"]*"[^>]*>([^<]{2,30})</i);
    if (cityMatch) city = cityMatch[1].trim().toLowerCase();
    return {
      sourceName: 'otosor',
      sourceUrl: url,
      make: slug.make,
      model: slug.model,
      year: slug.year,
      price,
      currency: 'TRY',
      fuelType: slug.fuelType,
      transmission: slug.transmission,
      sellerType: 'Galeri',
      imageUrl,
      imageUrls: imageUrl ? [imageUrl] : [],
      city,
    };
  } catch {
    return null;
  }
}

async function main() {
  const max = parseInt(process.argv[2] || '180', 10);
  console.log(`[otosor-sitemap] Starting (max=${max}) at ${new Date().toISOString()}`);

  // Step 1: get all listing URLs from sitemap
  const urls = await fetchSitemapUrls();
  console.log(`[otosor-sitemap] Total listing URLs: ${urls.length}`);

  // Shuffle and take a sample (don't always grab the same first 200)
  const shuffled = [...urls].sort(() => Math.random() - 0.5);

  // Parse slug for each, filter out failures
  const parsed: Array<{ url: string; slug: NonNullable<ReturnType<typeof parseSlug>> }> = [];
  for (const u of shuffled) {
    const s = parseSlug(u);
    if (s) parsed.push({ url: u, slug: s });
  }
  console.log(`[otosor-sitemap] Parsed ${parsed.length}/${urls.length} URLs`);

  // Fetch detail pages in parallel — fetch more than `max` because some will fail
  const toFetch = parsed.slice(0, Math.min(parsed.length, max * 2));
  console.log(`[otosor-sitemap] Fetching ${toFetch.length} detail pages...`);

  const listings: ListingRaw[] = [];
  const queue = [...toFetch];
  let processed = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < MAX_PARALLEL; w++) {
    workers.push((async () => {
      while (queue.length > 0 && listings.length < max) {
        const item = queue.shift();
        if (!item) break;
        const parsed_listing = await fetchOne(item.url, item.slug);
        if (parsed_listing) listings.push(parsed_listing);
        processed++;
        if (processed % 20 === 0) {
          console.log(`[otosor-sitemap] Progress: ${processed}/${toFetch.length} processed, ${listings.length}/${max} valid`);
        }
      }
    })());
  }
  await Promise.all(workers);

  // Write output
  const outPath = path.join(process.cwd(), 'data', 'scraped-otosor.json');
  fs.writeFileSync(outPath, JSON.stringify(listings, null, 2), 'utf-8');
  const sizeKb = fs.statSync(outPath).size / 1024;
  console.log(`[otosor-sitemap] ✅ Wrote ${listings.length} listings to ${outPath} (${sizeKb.toFixed(1)} KB)`);

  // Sample
  if (listings.length > 0) {
    const s = listings[0];
    console.log(`Sample: ${s.make} ${s.model} ${s.year} - ${s.price.toLocaleString('tr-TR')} TL`);
    console.log(`  URL: ${s.sourceUrl}`);
  }
  console.log(`[otosor-sitemap] Finished at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
