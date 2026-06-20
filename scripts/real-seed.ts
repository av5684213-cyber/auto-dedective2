import { db } from '../src/lib/db';
import { runAllAdapters } from '../src/lib/adapters';
import { normalizeListing } from '../src/lib/services/normalizer';
import { valueAllListings, revalueAllListings } from '../src/lib/services/valuator';
import { estimateAllCosts } from '../src/lib/services/cost-estimator';

async function seed() {
  console.log("═════════════════════════════════════════════════════════");
  console.log("  ARACIKIYAS - Gerçek Veri ile Seed (Sadece Letgo)");
  console.log("═════════════════════════════════════════════════════════\n");

  // Step 1: Scrape real data
  console.log("📡 Step 1: Gerçek veri çekiliyor (Letgo)...\n");
  const { listings: rawListings, results } = await runAllAdapters();
  
  console.log("Sonuçlar:");
  for (const r of results) {
    console.log(`  ${r.sourceName}: ${r.itemsFound} bulunan, ${r.itemsSaved} kaydedilen, ${r.status} (${(r.durationMs/1000).toFixed(1)}s)`);
  }
  console.log(`\nToplam: ${rawListings.length} ilan\n`);

  // Step 2: Process listings (normalize + upsert)
  console.log("💾 Step 2: Veritabanına kaydediliyor...\n");
  let saved = 0;
  for (const raw of rawListings) {
    try {
      const normalized = normalizeListing(raw);
      
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
              fuelType: normalized.fuelType ?? null,
              transmission: normalized.transmission ?? null,
              bodyType: normalized.bodyType ?? null,
              color: normalized.color ?? null,
              city: normalized.city ?? null,
              district: normalized.district ?? null,
              sellerType: normalized.sellerType ?? null,
              imageUrl: normalized.imageUrl ?? null,
              imageUrls: normalized.imageUrls ? JSON.stringify(normalized.imageUrls) : '[]',
              description: normalized.description ?? null,
              lastSeenAt: new Date(),
              isActive: true,
            },
          });
        } else {
          await db.listing.update({
            where: { id: existing.id },
            data: { lastSeenAt: new Date(), isActive: true },
          });
        }
      } else {
        await db.listing.create({
          data: {
            sourceName: normalized.sourceName,
            sourceUrl: normalized.sourceUrl,
            make: normalized.make,
            model: normalized.model,
            trim: normalized.trim ?? null,
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
            imageUrls: normalized.imageUrls ? JSON.stringify(normalized.imageUrls) : '[]',
            description: normalized.description ?? null,
            isActive: true,
          },
        });
      }
      saved++;
    } catch (e: any) {
      console.error(`  Hata: ${e.message.substring(0, 60)}`);
    }
  }
  console.log(`  ${saved} ilan kaydedildi\n`);

  // Step 3: Valuation
  console.log("📊 Step 3: Değerleme yapılıyor...\n");
  const valResults = await revalueAllListings();
  console.log(`  Değerlenen: ${valResults.valued}, Atlanan: ${valResults.skipped}, Hata: ${valResults.failed}\n`);

  // Step 4: Cost estimation
  console.log("💰 Step 4: Maliyet hesaplanıyor...\n");
  const costResults = await estimateAllCosts();
  console.log(`  Hesaplanan: ${costResults.estimated}, Atlanan: ${costResults.skipped}\n`);

  // Step 5: Stats
  const totalActive = await db.listing.count({ where: { isActive: true, isDeleted: false } });
  const byTag = await db.listing.groupBy({ by: ['dealTag'], where: { isActive: true, isDeleted: false, dealTag: { not: null } }, _count: true });
  const byMake = await db.listing.groupBy({ by: ['make'], where: { isActive: true, isDeleted: false }, _count: true, orderBy: { _count: { make: 'desc' } } });
  
  console.log("═════════════════════════════════════════════════════════");
  console.log("  ÖZET");
  console.log("═════════════════════════════════════════════════════════");
  console.log(`  Toplam ilan: ${totalActive}`);
  console.log(`  Kaynak: Letgo (gerçek scraping)`);
  console.log(`  Markalar:`);
  for (const m of byMake) {
    console.log(`    ${m.make}: ${m._count}`);
  }
  console.log(`  Fırsat dağılımı:`);
  for (const t of byTag) {
    console.log(`    ${t.dealTag}: ${t._count}`);
  }
  console.log("═════════════════════════════════════════════════════════");
}

seed().catch(console.error);
