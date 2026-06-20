import { db } from '@/lib/db';
const listings = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  select: { sourceUrl: true, make: true, model: true, year: true, price: true, mileageKm: true, fuelType: true, transmission: true },
});
console.log(`Remaining arabam: ${listings.length}`);
for (const l of listings) {
  console.log(`• ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺`);
  console.log(`  URL: ${l.sourceUrl}`);
  console.log(`  km=${l.mileageKm} fuel=${l.fuelType} trans=${l.transmission}`);
}
await db.$disconnect();
