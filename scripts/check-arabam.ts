import { db } from '@/lib/db';

const arabamListings = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  take: 5,
  select: {
    make: true, model: true, year: true, price: true, mileageKm: true,
    city: true, fuelType: true, transmission: true, bodyType: true,
    color: true, imageUrl: true, description: true, sourceUrl: true,
  },
});

console.log('Sample arabam listings:');
for (const l of arabamListings) {
  console.log(`  ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺`);
  console.log(`    km=${l.mileageKm}, city=${l.city}, fuel=${l.fuelType}, trans=${l.transmission}`);
  console.log(`    body=${l.bodyType}, color=${l.color}`);
  console.log(`    image=${l.imageUrl ? 'YES' : 'NO'}, desc=${l.description ? 'YES' : 'NO'}`);
  console.log(`    URL: ${l.sourceUrl}`);
  console.log('');
}

const stats = await db.listing.aggregate({
  where: { sourceName: 'arabam', isActive: true },
  _count: true,
  _sum: { mileageKm: true },
});
console.log(`Total arabam: ${stats._count}`);

// Check how many have null fields
const nullFuel = await db.listing.count({ where: { sourceName: 'arabam', fuelType: null } });
const nullTrans = await db.listing.count({ where: { sourceName: 'arabam', transmission: null } });
const nullImage = await db.listing.count({ where: { sourceName: 'arabam', imageUrl: null } });
const nullDesc = await db.listing.count({ where: { sourceName: 'arabam', description: null } });
console.log(`Null fuelType: ${nullFuel}/${stats._count}`);
console.log(`Null transmission: ${nullTrans}/${stats._count}`);
console.log(`Null imageUrl: ${nullImage}/${stats._count}`);
console.log(`Null description: ${nullDesc}/${stats._count}`);

await db.$disconnect();
