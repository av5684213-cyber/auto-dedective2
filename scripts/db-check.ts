import { db } from '@/lib/db';
const bySource = await db.listing.groupBy({ by: ['sourceName'], where: { isActive: true }, _count: true });
console.log('Sources in DB:');
for (const s of bySource) console.log(`  ${s.sourceName}: ${s._count}`);
const recent = await db.scrapeLog.findMany({
  orderBy: { endTime: 'desc' },
  take: 5,
  select: { sourceName: true, status: true, itemsFound: true, itemsSaved: true, endTime: true, durationMs: true },
});
console.log('\nRecent scrape logs:');
for (const r of recent) console.log(`  ${r.endTime.toISOString()} ${r.sourceName}: ${r.status} found=${r.itemsFound} saved=${r.itemsSaved} (${r.durationMs}ms)`);
await db.$disconnect();
