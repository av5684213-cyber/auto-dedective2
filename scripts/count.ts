import { db } from '@/lib/db';
const count = await db.listing.count({ where: { isActive: true } });
console.log(`Active listings: ${count}`);
const sample = await db.listing.findMany({
  where: { isActive: true },
  take: 10,
  select: { make: true, model: true, year: true, price: true, city: true, dealTag: true, estimatedValue: true, ownershipCostAnnual: true },
});
console.log('\nSample:');
for (const s of sample) {
  console.log(`  ${s.year} ${s.make} ${s.model} — ${s.price.toLocaleString('tr-TR')}₺ — value: ${s.estimatedValue?.toLocaleString('tr-TR') ?? '-'} — ${s.city} — ${s.dealTag ?? '-'}`);
}
await db.$disconnect();
