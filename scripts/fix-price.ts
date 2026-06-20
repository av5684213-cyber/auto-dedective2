import { db } from '@/lib/db';

// Find listings with unrealistic prices (> 10 million TL)
const badListings = await db.listing.findMany({
  where: { price: { gt: 10000000 } },
  select: { id: true, make: true, model: true, year: true, price: true, sourceUrl: true },
});

console.log(`Found ${badListings.length} listings with suspicious prices:`);
for (const l of badListings) {
  console.log(`  ${l.year} ${l.make} ${l.model} — ${l.price.toLocaleString('tr-TR')}₺`);
  console.log(`    URL: ${l.sourceUrl}`);
  
  // Delete these — they have parse errors
  await db.listing.delete({ where: { id: l.id } });
  console.log(`    ✓ Deleted`);
}

await db.$disconnect();
