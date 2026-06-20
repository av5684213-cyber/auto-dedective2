import { db } from '@/lib/db';

// Delete all arabam listings
const deleted = await db.listing.deleteMany({ where: { sourceName: 'arabam' } });
console.log(`Deleted ${deleted.count} old arabam listings`);

// Also delete arabam price history
const ph = await db.priceHistory.deleteMany({
  where: { listing: { sourceName: 'arabam' } },
});
console.log(`Deleted ${ph.count} price history entries`);

await db.$disconnect();
