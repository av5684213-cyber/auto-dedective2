import { db } from '@/lib/db';
const listings = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  take: 10,
  select: { sourceUrl: true, make: true, model: true, year: true, price: true },
});
console.log(`Total arabam: ${await db.listing.count({ where: { sourceName: 'arabam', isActive: true } })}\n`);
for (const l of listings) {
  console.log(`• ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺`);
  console.log(`  URL: ${l.sourceUrl}`);
  // Extract listing ID from URL
  const idMatch = l.sourceUrl.match(/\/(\d+)(?:\/?$)/);
  console.log(`  ID: ${idMatch ? idMatch[1] : 'NONE'}`);
  console.log('');
}
await db.$disconnect();
