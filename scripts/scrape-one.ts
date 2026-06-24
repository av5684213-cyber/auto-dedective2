// Single-source scraper runner — runs ONE source and writes its output to
// data/scraped-{source}.json. Designed to be invoked multiple times so we
// never hit the bash tool timeout.
//
// Usage:  npx tsx scripts/scrape-one.ts <source> [max]
//   source: otosor | fordikinciel | intercity2 | letgo

import * as fs from 'node:fs';
import * as path from 'node:path';
import { bulkScrapeOtosor } from '../src/lib/services/otosor-scraper';
import { bulkScrapeFordikinciel } from '../src/lib/services/fordikinciel-scraper';
import { bulkScrapeIntercity2 } from '../src/lib/services/intercity2-scraper';
import { bulkScrapeLetgo } from '../src/lib/services/letgo-sitemap-scraper';
import type { ListingRaw } from '../src/lib/adapters/base';

async function main() {
  const source = process.argv[2] as 'otosor' | 'fordikinciel' | 'intercity2' | 'letgo';
  const max = parseInt(process.argv[3] || '120', 10);

  if (!source) {
    console.error('Usage: npx tsx scripts/scrape-one.ts <source> [max]');
    process.exit(1);
  }

  console.log(`[${source}] Starting scrape (max=${max}) at ${new Date().toISOString()}`);

  let listings: ListingRaw[] = [];

  if (source === 'otosor') {
    const result = await bulkScrapeOtosor(max);
    listings = result.listings;
    console.log(`[otosor] pagesScanned=${result.pagesScanned}, totalUrls=${result.totalUrls}, listings=${listings.length}`);
  } else if (source === 'fordikinciel') {
    const result = await bulkScrapeFordikinciel(max);
    listings = result.listings;
    console.log(`[fordikinciel] totalUrls=${result.totalUrls}, listings=${listings.length}`);
  } else if (source === 'intercity2') {
    const result = await bulkScrapeIntercity2(max);
    listings = result.listings;
    console.log(`[intercity2] totalIds=${result.totalIds}, listings=${listings.length}`);
  } else if (source === 'letgo') {
    const sitemapCount = parseInt(process.env.LETGO_SITEMAPS || '8', 10);
    const result = await bulkScrapeLetgo(max, sitemapCount);
    listings = result.listings;
    console.log(`[letgo] sitemaps=${result.scannedSitemaps}, carUrls=${result.carUrls}, listings=${listings.length}`);
  } else {
    console.error('Unknown source:', source);
    process.exit(1);
  }

  // Write to data/scraped-{source}.json
  const outPath = path.join(process.cwd(), 'data', `scraped-${source}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(listings, null, 2), 'utf-8');

  const sizeKb = fs.statSync(outPath).size / 1024;
  console.log(`[${source}] ✅ Wrote ${listings.length} listings to ${outPath} (${sizeKb.toFixed(1)} KB)`);

  // Show a sample
  if (listings.length > 0) {
    console.log(`[${source}] Sample listing:`);
    const s = listings[0];
    console.log(`  ${s.make} ${s.model} ${s.year} - ${s.price.toLocaleString('tr-TR')} TL`);
    console.log(`  URL: ${s.sourceUrl}`);
    if (s.city) console.log(`  city: ${s.city}`);
    if (s.mileageKm) console.log(`  km: ${s.mileageKm}`);
    if (s.fuelType) console.log(`  fuel: ${s.fuelType}`);
  }

  console.log(`[${source}] Finished at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error(`FATAL [${process.argv[2]}]:`, err);
  process.exit(1);
});
