import { db } from '@/lib/db';
import { Valuator } from '@/lib/services/valuator';

async function main() {
  console.log('Running Valuator on all listings...');
  await Valuator.updateAllListings();
  const byTag = await db.listing.groupBy({
    by: ['dealTag'],
    _count: true,
    orderBy: { _count: { dealTag: 'desc' } },
  });
  console.log('\nDeal tag distribution:');
  for (const row of byTag) {
    console.log(`  ${row.dealTag ?? '(null)'}: ${row._count}`);
  }
  const nullEst = await db.listing.count({ where: { estimatedValue: null } });
  console.log(`\nListings with NULL estimated_value: ${nullEst}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
