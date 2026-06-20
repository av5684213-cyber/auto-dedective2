#!/usr/bin/env bun
// ── AracıKıyas Seed Script ──────────────────────────────────────────────
// Populates the database with mock data from all adapters, then runs
// valuation, cost estimation, and deduplication pipelines.

import { db } from '@/lib/db';
import { scrapeAll } from '@/lib/services/scraper';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import { runDeduplication } from '@/lib/services/deduplicator';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  AracıKıyas - Seed Script');
  console.log('═══════════════════════════════════════════════════════');
  console.log();

  // ── Step 1: Run all adapters (scrape + normalize + save to DB) ──────
  console.log('🔍 Step 1: Running all adapters (scrape, normalize, save)...');
  const startTime = Date.now();
  const scrapeResults = await scrapeAll();
  const scrapeDuration = Date.now() - startTime;

  console.log(`   Completed in ${(scrapeDuration / 1000).toFixed(1)}s`);
  for (const result of scrapeResults) {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`   ${icon} ${result.sourceName}: ${result.itemsFound} found, ${result.itemsSaved} saved (${result.durationMs}ms)`);
    if (result.errorMsg) {
      console.log(`      Error: ${result.errorMsg}`);
    }
  }
  console.log();

  // ── Step 2: Run valuation engine ────────────────────────────────────
  console.log('💰 Step 2: Running valuation engine on all listings...');
  const valStartTime = Date.now();
  const valuationResults = await valueAllListings();
  const valDuration = Date.now() - valStartTime;

  console.log(`   Completed in ${(valDuration / 1000).toFixed(1)}s`);
  console.log(`   Valued: ${valuationResults.valued}, Skipped: ${valuationResults.skipped}, Failed: ${valuationResults.failed}`);
  console.log();

  // ── Step 3: Run cost estimator ──────────────────────────────────────
  console.log('🧮 Step 3: Running cost estimator on all listings...');
  const costStartTime = Date.now();
  const costResults = await estimateAllCosts();
  const costDuration = Date.now() - costStartTime;

  console.log(`   Completed in ${(costDuration / 1000).toFixed(1)}s`);
  console.log(`   Estimated: ${costResults.estimated}, Skipped: ${costResults.skipped}`);
  console.log();

  // ── Step 4: Run deduplication ───────────────────────────────────────
  console.log('🔗 Step 4: Running deduplication...');
  const dedupStartTime = Date.now();
  const dedupResults = await runDeduplication();
  const dedupDuration = Date.now() - dedupStartTime;

  console.log(`   Completed in ${(dedupDuration / 1000).toFixed(1)}s`);
  console.log(`   Groups created: ${dedupResults.groupsCreated}, Updated: ${dedupResults.groupsUpdated}`);
  console.log();

  // ── Step 5: Print summary statistics ────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Summary Statistics');
  console.log('═══════════════════════════════════════════════════════');

  const totalActive = await db.listing.count({ where: { isActive: true, isDeleted: false } });
  const totalAll = await db.listing.count();
  console.log(`  Total listings (all):       ${totalAll}`);
  console.log(`  Total active listings:      ${totalActive}`);

  // By source
  const bySource = await db.listing.groupBy({
    by: ['sourceName'],
    where: { isActive: true, isDeleted: false },
    _count: { sourceName: true },
    orderBy: { _count: { sourceName: 'desc' } },
  });
  console.log();
  console.log('  By Source:');
  for (const s of bySource) {
    console.log(`    ${s.sourceName}: ${s._count.sourceName}`);
  }

  // By make (top 10)
  const byMake = await db.listing.groupBy({
    by: ['make'],
    where: { isActive: true, isDeleted: false },
    _count: { make: true },
    orderBy: { _count: { make: 'desc' } },
    take: 10,
  });
  console.log();
  console.log('  Top Makes:');
  for (const m of byMake) {
    console.log(`    ${m.make}: ${m._count.make}`);
  }

  // Deal tag distribution
  const byDealTag = await db.listing.groupBy({
    by: ['dealTag'],
    where: { isActive: true, isDeleted: false, dealTag: { not: null } },
    _count: { dealTag: true },
    orderBy: { _count: { dealTag: 'desc' } },
  });
  console.log();
  console.log('  Deal Tag Distribution:');
  for (const d of byDealTag) {
    if (d.dealTag) {
      console.log(`    ${d.dealTag}: ${d._count.dealTag}`);
    }
  }

  // Average price
  const avgPrice = await db.listing.aggregate({
    where: { isActive: true, isDeleted: false },
    _avg: { price: true },
    _min: { price: true },
    _max: { price: true },
  });
  console.log();
  console.log('  Price Range:');
  console.log(`    Min: ₺${(avgPrice._min.price ?? 0).toLocaleString('tr-TR')}`);
  console.log(`    Avg: ₺${Math.round(avgPrice._avg.price ?? 0).toLocaleString('tr-TR')}`);
  console.log(`    Max: ₺${(avgPrice._max.price ?? 0).toLocaleString('tr-TR')}`);

  // Duplicate groups
  const totalDupGroups = await db.duplicateGroup.count();
  console.log();
  console.log(`  Duplicate Groups: ${totalDupGroups}`);

  const totalDuration = Date.now() - startTime;
  console.log();
  console.log(`⏱  Total seed time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════════════════');

  await db.$disconnect();
}

main().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
