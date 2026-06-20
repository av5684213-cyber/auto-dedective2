import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { normalizeListing } from '@/lib/services/normalizer';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import type { RawListing } from '@/lib/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const urls = [
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=4',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=6',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=7',
  'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=nissan',
];

const allListings: RawListing[] = [];
const seen = new Set<string>();

for (const url of urls) {
  try {
    console.log(`Fetching: ${url.substring(70)}...`);
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 30000,
      validateStatus: () => true,
      maxRedirects: 5,
    });
    if (res.status !== 200 || res.data.length < 30000) {
      console.log(`  ✗ HTTP ${res.status}, len ${res.data?.length || 0}`);
      continue;
    }
    const $ = cheerio.load(res.data);
    let count = 0;
    $('a[href*="/ilan/"]').each((_, el) => {
      try {
        const $el = $(el);
        const $card = $el.closest('div, li, article, tr');
        if (!$card.length) return;
        const archiveHref = $el.attr('href') || '';
        const match = archiveHref.match(/\/web\/\d+\/(https?:\/\/.+)/);
        if (!match) return;
        const sourceUrl = match[1];
        if (seen.has(sourceUrl)) return;
        const title = ($el.text().trim() || $card.find('.listing-title, .title, h3').first().text().trim()).substring(0, 200);
        if (!title) return;
        const cardText = $card.text();
        const priceMatch = cardText.match(/([0-9]{1,3}(\.[0-9]{3})+)\s*TL/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/\./g, '')) : 0;
        if (!price) return;
        const yearMatch = cardText.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : 0;
        const kmMatch = cardText.match(/([0-9]{1,3}(\.[0-9]{3})*)\s*km/i);
        const mileageKm = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : undefined;
        const cityMatch = cardText.match(/(İstanbul|Ankara|İzmir|Bursa|Antalya|Adana|Konya|Gaziantep|Mersin|Kayseri|Eskişehir|Samsun|Denizli|Trabzon|Muğla|Aydın|Balıkesir|Sakarya|Kocaeli|Tekirdağ|Hatay|Diyarbakır|Şanlıurfa|Malatya|Erzurum|Manisa|Zonguldak|Kahramanmaraş|Aydın|Çorum|İzmit|Van|Bolu|Düzce)/);
        const city = cityMatch ? cityMatch[1] : undefined;
        const parts = title.split(/\s+/);
        let make = parts[0] || '';
        let model = parts.slice(1).join(' ');
        if (/satilik|satılık|galeriden|sahibinden/i.test(make)) {
          make = parts[1] || '';
          model = parts.slice(2).join(' ');
        }
        if (make && price > 0) {
          seen.add(sourceUrl);
          allListings.push({
            sourceName: 'arabam',
            sourceUrl,
            make, model, year, price, currency: 'TRY',
            mileageKm, city,
            imageUrls: [],
          });
          count++;
        }
      } catch {}
    });
    console.log(`  ✓ ${count} new listings (total: ${allListings.length})`);
  } catch (e: any) {
    console.log(`  ✗ ${e.message.substring(0, 80)}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

console.log(`\n=== Total: ${allListings.length} listings ===`);

// Save to DB
let saved = 0;
for (const raw of allListings) {
  try {
    const normalized = normalizeListing(raw) as any;
    if (!normalized.sourceUrl || !normalized.make) continue;
    const existing = await db.listing.findUnique({
      where: { sourceUrl: normalized.sourceUrl },
      select: { id: true },
    });
    if (existing) continue;
    await db.listing.create({
      data: {
        sourceName: normalized.sourceName,
        sourceUrl: normalized.sourceUrl,
        make: normalized.make, model: normalized.model,
        year: normalized.year, price: normalized.price, currency: normalized.currency,
        mileageKm: normalized.mileageKm ?? null,
        city: normalized.city ?? null,
        imageUrls: '[]',
        lastSeenAt: new Date(), isActive: true, isDeleted: false,
      },
    });
    saved++;
  } catch {}
}
console.log(`Saved ${saved} new listings`);

console.log('Running valuation...');
await valueAllListings();
console.log('Running cost estimation...');
await estimateAllCosts();

const bySource = await db.listing.groupBy({ by: ['sourceName'], where: { isActive: true }, _count: true });
console.log('\nFinal DB state:');
for (const s of bySource) console.log(`  ${s.sourceName}: ${s._count}`);

await db.$disconnect();
