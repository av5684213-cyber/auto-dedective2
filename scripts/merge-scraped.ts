// Merge all scraped-*.json files into data/letgo-listings.json (the fallback dataset).
//
// - Reads data/scraped-{otosor,fordikinciel,intercity2,letgo}.json
// - Converts ListingRaw → FallbackListing format
// - Deduplicates by sourceUrl
// - Writes the merged result to data/letgo-listings.json (overwrites)
//
// Usage:  npx tsx scripts/merge-scraped.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
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

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function toFallback(raw: ListingRaw, idx: number): FallbackListing {
  const now = new Date().toISOString();
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

function main() {
  const dataDir = path.join(process.cwd(), 'data');
  const sources = ['otosor', 'fordikinciel', 'intercity2', 'letgo'];
  const merged = new Map<string, FallbackListing>(); // key=sourceUrl
  let totalRaw = 0;

  console.log('=== Merging scraped data ===');

  for (const src of sources) {
    const p = path.join(dataDir, `scraped-${src}.json`);
    if (!fs.existsSync(p)) {
      console.log(`  ${src}: skipped (file not found)`);
      continue;
    }
    const rawListings = JSON.parse(fs.readFileSync(p, 'utf-8')) as ListingRaw[];
    console.log(`  ${src}: ${rawListings.length} listings loaded`);
    totalRaw += rawListings.length;

    let added = 0;
    let dup = 0;
    rawListings.forEach((raw, i) => {
      if (merged.has(raw.sourceUrl)) {
        dup++;
        return;
      }
      merged.set(raw.sourceUrl, toFallback(raw, merged.size));
      added++;
    });
    console.log(`    → added ${added}, skipped ${dup} duplicates`);
  }

  const final = Array.from(merged.values());
  console.log(`\nTotal raw listings: ${totalRaw}`);
  console.log(`After dedup by sourceUrl: ${final.length}`);

  // Stats
  const bySource = new Map<string, number>();
  const byMake = new Map<string, number>();
  const byCity = new Map<string, number>();
  for (const l of final) {
    bySource.set(l.sourceName, (bySource.get(l.sourceName) ?? 0) + 1);
    if (l.make) byMake.set(l.make, (byMake.get(l.make) ?? 0) + 1);
    if (l.city) byCity.set(l.city, (byCity.get(l.city) ?? 0) + 1);
  }

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

  // Write to data/letgo-listings.json (the fallback file the app reads)
  const outPath = path.join(dataDir, 'letgo-listings.json');
  fs.writeFileSync(outPath, JSON.stringify(final, null, 2), 'utf-8');
  const sizeKb = fs.statSync(outPath).size / 1024;
  console.log(`\n✅ Wrote ${final.length} REAL listings to ${outPath} (${sizeKb.toFixed(1)} KB)`);
}

main();
