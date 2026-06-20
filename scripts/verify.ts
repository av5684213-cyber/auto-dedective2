import { db } from '@/lib/db';
const listings = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  take: 5,
  select: { sourceUrl: true, make: true, model: true, year: true, price: true, mileageKm: true, fuelType: true, transmission: true, bodyType: true, color: true, city: true, sellerType: true },
});
console.log(`Total arabam: ${await db.listing.count({ where: { sourceName: 'arabam', isActive: true } })}\n`);
for (const l of listings) {
  console.log(`• ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺`);
  console.log(`  URL: ${l.sourceUrl}`);
  console.log(`  km=${l.mileageKm} fuel=${l.fuelType} trans=${l.transmission} body=${l.bodyType} color=${l.color} city="${l.city}" seller=${l.sellerType}`);
  console.log('');
}
await db.$disconnect();
