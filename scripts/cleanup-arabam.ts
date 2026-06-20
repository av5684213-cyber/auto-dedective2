import { db } from '@/lib/db';

// Count before
const before = await db.listing.groupBy({
  by: ['sourceName'],
  where: { isActive: true },
  _count: true,
});
console.log('Before cleanup:');
for (const s of before) console.log(`  ${s.sourceName}: ${s._count}`);

// Delete arabam (also delete their price history first)
const arabamListings = await db.listing.findMany({
  where: { sourceName: 'arabam' },
  select: { id: true },
});
console.log(`\nDeleting ${arabamListings.length} arabam listings...`);

// Delete price history for arabam listings
const deletePH = await db.priceHistory.deleteMany({
  where: { listingId: { in: arabamListings.map(l => l.id) } },
});
console.log(`  Deleted ${deletePH.count} price history entries`);

// Delete arabam listings
const deleted = await db.listing.deleteMany({
  where: { sourceName: 'arabam' },
});
console.log(`  Deleted ${deleted.count} arabam listings`);

// Count after
const after = await db.listing.groupBy({
  by: ['sourceName'],
  where: { isActive: true },
  _count: true,
});
console.log('\nAfter cleanup:');
for (const s of after) console.log(`  ${s.sourceName}: ${s._count}`);

// Also delete arabam scrape logs
const delLogs = await db.scrapeLog.deleteMany({
  where: { sourceName: 'arabam' },
});
console.log(`\nDeleted ${delLogs.count} arabam scrape logs`);

await db.$disconnect();
