#!/usr/bin/env bun
/**
 * Fast Letgo-only seed: scrape one page, save to DB, value, cost-estimate.
 * Bypasses the long adapter timeout chain — direct call + UPSERT.
 */
import { db } from '@/lib/db';
import { LetgoAdapter } from '@/lib/adapters/letgo';
import { normalizeListing } from '@/lib/services/normalizer';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  AracıKıyas - Letgo Real Data Seed');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── Step 1: Scrape Letgo (multiple categories, ~150 listings) ───────
  console.log('🔍 Step 1: Scraping Letgo (multiple categories)...');
  const adapter = new LetgoAdapter();
  const t0 = Date.now();
  const result = await adapter.search({ limit: 500 });
  console.log(`   ✓ Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   Found: ${result.totalFound} listings\n`);

  if (result.listings.length === 0) {
    console.error('   ✗ No listings scraped. Aborting.');
    process.exit(1);
  }

  // ── Step 2: Normalize & UPSERT into DB ──────────────────────────────
  console.log('💾 Step 2: Normalizing and saving to DB...');
  let saved = 0;
  let updated = 0;
  let errors = 0;

  for (const raw of result.listings) {
    try {
      const normalized = normalizeListing(raw as any) as any;

      const existing = await db.listing.findUnique({
        where: { sourceUrl: normalized.sourceUrl },
        select: { id: true, price: true },
      });

      if (existing) {
        if (existing.price !== normalized.price) {
          await db.priceHistory.create({
            data: { listingId: existing.id, price: existing.price },
          });
          await db.listing.update({
            where: { id: existing.id },
            data: {
              price: normalized.price,
              mileageKm: normalized.mileageKm ?? null,
              city: normalized.city ?? null,
              district: normalized.district ?? null,
              sellerType: normalized.sellerType ?? null,
              imageUrl: normalized.imageUrl ?? null,
              imageUrls: normalized.imageUrls
                ? JSON.stringify(normalized.imageUrls)
                : '[]',
              lastSeenAt: new Date(),
              isActive: true,
              isDeleted: false,
            },
          });
        } else {
          await db.listing.update({
            where: { id: existing.id },
            data: { lastSeenAt: new Date(), isActive: true, isDeleted: false },
          });
        }
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
            sellerType: normalized.sellerType ?? null,
            imageUrl: normalized.imageUrl ?? null,
            imageUrls: normalized.imageUrls
              ? JSON.stringify(normalized.imageUrls)
              : '[]',
            description: normalized.description ?? null,
            lastSeenAt: new Date(),
            isActive: true,
            isDeleted: false,
          },
        });
        saved++;
      }
    } catch (e: any) {
      console.error(`   ✗ Error on listing: ${e.message}`);
      errors++;
    }
  }

  console.log(`   ✓ Saved: ${saved} new, ${updated} updated, ${errors} errors\n`);

  // ── Step 3: Log scrape result ───────────────────────────────────────
  try {
    await db.scrapeLog.create({
      data: {
        sourceName: 'letgo',
        startTime: new Date(t0),
        endTime: new Date(),
        status: 'success',
        itemsFound: result.totalFound,
        itemsSaved: saved,
        durationMs: Date.now() - t0,
      },
    });
  } catch (e: any) {
    console.error('   ScrapeLog error:', e.message);
  }

  // ── Step 4: Valuation ───────────────────────────────────────────────
  console.log('📊 Step 3: Running valuation...');
  try {
    const v = await valueAllListings();
    console.log(`   ✓ ${v.processed} valued, ${v.skipped} skipped\n`);
  } catch (e: any) {
    console.error(`   Valuation error: ${e.message}\n`);
  }

  // ── Step 5: Cost estimation ─────────────────────────────────────────
  console.log('💰 Step 4: Estimating ownership costs...');
  try {
    const c = await estimateAllCosts();
    console.log(`   ✓ ${c.processed} estimated\n`);
  } catch (e: any) {
    console.error(`   Cost est error: ${e.message}\n`);
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const totalActive = await db.listing.count({ where: { isActive: true } });
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ Done. ${totalActive} active listings in DB.`);
  console.log('═══════════════════════════════════════════════════════');

  // Show sample
  const sample = await db.listing.findMany({
    where: { isActive: true },
    take: 5,
    orderBy: { firstSeenAt: 'desc' },
    select: { make: true, model: true, year: true, price: true, city: true, dealTag: true },
  });
  console.log('\nSample listings:');
  for (const s of sample) {
    console.log(
      `  • ${s.year} ${s.make} ${s.model} — ${s.price.toLocaleString('tr-TR')} ₺` +
        ` — ${s.city ?? '?'} — ${s.dealTag ?? '-'}`,
    );
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
