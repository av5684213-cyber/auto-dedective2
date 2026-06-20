import { db } from '@/lib/db';
const listings = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  select: { sourceUrl: true },
});
const ids = listings.map(l => {
  const m = l.sourceUrl.match(/\/(\d+)(?:\/?$)/);
  return m ? parseInt(m[1]) : 0;
}).filter(id => id > 0).sort((a, b) => a - b);

console.log(`Total: ${ids.length}`);
console.log(`Min ID: ${ids[0]} (oldest listing)`);
console.log(`Max ID: ${ids[ids.length - 1]} (newest listing)`);
console.log(`Median ID: ${ids[Math.floor(ids.length / 2)]}`);

// Group by ID range
const ranges = [
  { label: '< 30M (very old)', min: 0, max: 30000000 },
  { label: '30M-35M', min: 30000000, max: 35000000 },
  { label: '35M-40M', min: 35000000, max: 40000000 },
  { label: '40M+ (newest)', min: 40000000, max: 99999999 },
];
for (const r of ranges) {
  const count = ids.filter(id => id >= r.min && id < r.max).length;
  console.log(`  ${r.label}: ${count} listings`);
}

await db.$disconnect();
