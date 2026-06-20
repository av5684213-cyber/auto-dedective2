import { db } from '@/lib/db';

// Get all arabam listings
const listings = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  select: { id: true, sourceUrl: true, make: true, model: true, year: true, price: true },
});

console.log(`Total arabam listings: ${listings.length}`);

// Extract listing ID from URL and filter
const toDelete: string[] = [];
const toKeep: string[] = [];

for (const l of listings) {
  const m = l.sourceUrl.match(/\/(\d+)(?:\/?$)/);
  const listingId = m ? parseInt(m[1]) : 0;
  
  // Keep only listings with ID > 35M (posted within ~2 months of May 2026)
  // This filters out older listings that are more likely to be sold/removed
  if (listingId >= 35000000) {
    toKeep.push(l.id);
  } else {
    toDelete.push(l.id);
    console.log(`  ✗ Removing (ID ${listingId}): ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺`);
  }
}

console.log(`\nKeeping: ${toKeep.length} (recent listings, ID > 35M)`);
console.log(`Removing: ${toDelete.length} (older listings, more likely sold/removed)`);

// Delete old listings
if (toDelete.length > 0) {
  await db.priceHistory.deleteMany({ where: { listingId: { in: toDelete } } });
  const result = await db.listing.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`\n✓ Deleted ${result.count} old listings`);
}

// Show remaining
const remaining = await db.listing.count({ where: { sourceName: 'arabam', isActive: true } });
console.log(`\nFinal arabam count: ${remaining}`);

// Show sample of remaining
const sample = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  take: 10,
  select: { sourceUrl: true, make: true, model: true, year: true, price: true, mileageKm: true, fuelType: true, transmission: true },
});
console.log('\nSample remaining listings:');
for (const l of sample) {
  const id = l.sourceUrl.match(/\/(\d+)(?:\/?$)/)?.[1];
  console.log(`  • [ID ${id}] ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺ — ${l.mileageKm}km — ${l.fuelType}/${l.transmission}`);
}

await db.$disconnect();
