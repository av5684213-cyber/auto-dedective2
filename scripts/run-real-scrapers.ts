// Otodedektif - Real scraper runner
//
// Runs all available scrapers (otosor, fordikinciel, intercity2, letgo-sitemap),
// collects REAL listings, and writes them to data/letgo-listings.json.
//
// Usage:  npx tsx scripts/run-real-scrapers.ts
//
// Output: data/letgo-listings.json (replaces the old fallback data)

import * as fs from 'node:fs';
import * as path from 'node:path';
import { bulkScrapeOtosor } from '../src/lib/services/otosor-scraper';
import { bulkScrapeFordikinciel } from '../src/lib/services/fordikinciel-scraper';
import { bulkScrapeIntercity2 } from '../src/lib/services/intercity2-scraper';
import { bulkScrapeLetgo } from '../src/lib/services/letgo-sitemap-scraper';
import type { ListingRaw } from '../src/lib/adapters/base';

interface FallbackListing {
  id: string;
  sourceName: string;
  sourceUrl: string;
  vin: string | null;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  price: number;
  currency: string;
  mileageKm: number | null;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  color: string | null;
  city: string | null;
  district: string | null;
  sellerType: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  description: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
  isDeleted: boolean;
  estimatedValue: number | null;
  confidence: string | null;
  dealScore: number | null;
  dealTag: string | null;
  comparableCount: number;
  annualDepreciationPercent: number | null;
  annualDepreciationAmount: number | null;
  ownershipCostAnnual: number | null;
  fuelCostAnnual: number | null;
  insuranceCostAnnual: number | null;
  maintenanceCostAnnual: number | null;
  taxCostAnnual: number | null;
  priceHistory: Array<{ id: string; price: number; recordedAt: string }>;
}

function toFallback(raw: ListingRaw, idx: number): FallbackListing {
  const now = new Date().toISOString();
  // Deterministic ID from source URL
  const urlHash = Math.abs(hashString(raw.sourceUrl)).toString(36);
  const id = `${raw.sourceName}-${urlHash}-${idx}`;

  return {
    id,
    sourceName: raw.sourceName,
    sourceUrl: raw.sourceUrl,
    vin: raw.vin ?? null,
    make: raw.make,
    model: raw.model,
    trim: raw.trim ?? null,
    year: raw.year,
    price: raw.price,
    currency: raw.currency ?? 'TRY',
    mileageKm: raw.mileageKm ?? null,
    fuelType: raw.fuelType ?? null,
    transmission: raw.transmission ?? null,
    bodyType: raw.bodyType ?? null,
    color: raw.color ?? null,
    city: raw.city ?? null,
    district: raw.district ?? null,
    sellerType: raw.sellerType ?? null,
    imageUrl: raw.imageUrl ?? null,
    imageUrls: raw.imageUrls ?? [],
    description: raw.description ?? null,
    firstSeenAt: now,
    lastSeenAt: now,
    isActive: true,
    isDeleted: false,
    estimatedValue: null,
    confidence: 'insufficient',
    dealScore: null,
    dealTag: 'Değerlendirilemedi',
    comparableCount: 0,
    annualDepreciationPercent: null,
    annualDepreciationAmount: null,
    ownershipCostAnnual: null,
    fuelCostAnnual: null,
    insuranceCostAnnual: null,
    maintenanceCostAnnual: null,
    taxCostAnnual: null,
    priceHistory: [],
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

async function main() {
  const allListings: ListingRaw[] = [];
  const seenUrls = new Set<string>();

  console.log('=== Otodedektif Real Scraper Runner ===');
  console.log('Started at:', new Date().toISOString());
  console.log();

  // ── 1. Otosor ────────────────────────────────────────────────────────
  try {
    console.log('>>> [1/4] Otosor scraper running...');
    const otosorResult = await bulkScrapeOtosor(150);
    console.log(`<<< Otosor: ${otosorResult.listings.length} listings (scanned ${otosorResult.pagesScanned} pages, ${otosorResult.totalUrls} URLs)`);
    for (const l of otosorResult.listings) {
      if (!seenUrls.has(l.sourceUrl)) {
        seenUrls.add(l.sourceUrl);
        allListings.push(l);
      }
    }
  } catch (err) {
    console.error('!!! Otosor failed:', (err as Error).message);
  }
  console.log(`    Running total: ${allListings.length}\n`);

  // ── 2. Fordikinciel ──────────────────────────────────────────────────
  try {
    console.log('>>> [2/4] Fordikinciel scraper running...');
    const fordResult = await bulkScrapeFordikinciel(150);
    console.log(`<<< Fordikinciel: ${fordResult.listings.length} listings (${fordResult.totalUrls} URLs)`);
    for (const l of fordResult.listings) {
      if (!seenUrls.has(l.sourceUrl)) {
        seenUrls.add(l.sourceUrl);
        allListings.push(l);
      }
    }
  } catch (err) {
    console.error('!!! Fordikinciel failed:', (err as Error).message);
  }
  console.log(`    Running total: ${allListings.length}\n`);

  // ── 3. Intercity2 ────────────────────────────────────────────────────
  try {
    console.log('>>> [3/4] Intercity2 scraper running...');
    const intercityResult = await bulkScrapeIntercity2(150);
    console.log(`<<< Intercity2: ${intercityResult.listings.length} listings (${intercityResult.totalIds} IDs)`);
    for (const l of intercityResult.listings) {
      if (!seenUrls.has(l.sourceUrl)) {
        seenUrls.add(l.sourceUrl);
        allListings.push(l);
      }
    }
  } catch (err) {
    console.error('!!! Intercity2 failed:', (err as Error).message);
  }
  console.log(`    Running total: ${allListings.length}\n`);

  // ── 4. Letgo sitemap ────────────────────────────────────────────────
  try {
    console.log('>>> [4/4] Letgo sitemap scraper running...');
    const letgoResult = await bulkScrapeLetgo(150, 3);
    console.log(`<<< Letgo: ${letgoResult.listings.length} listings (scanned ${letgoResult.scannedSitemaps} sitemaps, ${letgoResult.carUrls} car URLs)`);
    for (const l of letgoResult.listings) {
      if (!seenUrls.has(l.sourceUrl)) {
        seenUrls.add(l.sourceUrl);
        allListings.push(l);
      }
    }
  } catch (err) {
    console.error('!!! Letgo failed:', (err as Error).message);
  }
  console.log(`    Running total: ${allListings.length}\n`);

  // ── Convert to fallback format ───────────────────────────────────────
  console.log('=== Converting to fallback format ===');
  const fallbackListings: FallbackListing[] = allListings.map((l, i) => toFallback(l, i));

  // Deduplicate by sourceUrl one more time (safety)
  const deduped = new Map<string, FallbackListing>();
  for (const l of fallbackListings) {
    deduped.set(l.sourceUrl, l);
  }
  const finalListings = Array.from(deduped.values());

  // ── Stats ────────────────────────────────────────────────────────────
  const bySource = new Map<string, number>();
  const byMake = new Map<string, number>();
  const byCity = new Map<string, number>();
  for (const l of finalListings) {
    bySource.set(l.sourceName, (bySource.get(l.sourceName) ?? 0) + 1);
    if (l.make) byMake.set(l.make, (byMake.get(l.make) ?? 0) + 1);
    if (l.city) byCity.set(l.city, (byCity.get(l.city) ?? 0) + 1);
  }

  console.log('\n=== Final Statistics ===');
  console.log(`Total real listings: ${finalListings.length}`);
  console.log('\nListings per source:');
  for (const [s, c] of Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${c}`);
  }
  console.log('\nTop 10 makes:');
  for (const [m, c] of Array.from(byMake.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${m}: ${c}`);
  }
  console.log('\nTop 10 cities:');
  for (const [c, n] of Array.from(byCity.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${c}: ${n}`);
  }

  // ── Write to file ────────────────────────────────────────────────────
  const outPath = path.join(process.cwd(), 'data', 'letgo-listings.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(finalListings, null, 2), 'utf-8');
  const sizeKb = fs.statSync(outPath).size / 1024;
  console.log(`\n✅ Wrote ${finalListings.length} REAL listings to ${outPath} (${sizeKb.toFixed(1)} KB)`);
  console.log('Finished at:', new Date().toISOString());
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
