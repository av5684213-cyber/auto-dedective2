import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/services/cache';
import { loadFallbackListings } from '@/lib/services/fallback-data';

// ── Build stats from fallback dataset ──

function buildStatsFromFallback() {
  const listings = loadFallbackListings();
  const totalActive = listings.length;

  const sourceMap = new Map<string, number>();
  for (const l of listings) sourceMap.set(l.sourceName, (sourceMap.get(l.sourceName) || 0) + 1);
  const listingsPerSource = Array.from(sourceMap.entries()).map(([sourceName, count]) => ({ sourceName, count })).sort((a, b) => b.count - a.count);

  const makeMap = new Map<string, number>();
  for (const l of listings) if (l.make) makeMap.set(l.make, (makeMap.get(l.make) || 0) + 1);
  const listingsPerMake = Array.from(makeMap.entries()).map(([make, count]) => ({ make, count })).sort((a, b) => b.count - a.count).slice(0, 15);

  const cityMap = new Map<string, number>();
  for (const l of listings) if (l.city) cityMap.set(l.city, (cityMap.get(l.city) || 0) + 1);
  const listingsPerCity = Array.from(cityMap.entries()).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const dealTagMap = new Map<string, number>();
  for (const l of listings) if (l.dealTag) dealTagMap.set(l.dealTag, (dealTagMap.get(l.dealTag) || 0) + 1);
  const dealTagDistribution = Array.from(dealTagMap.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);

  const makePrices = new Map<string, number[]>();
  for (const l of listings) {
    if (l.make) {
      const arr = makePrices.get(l.make) || [];
      arr.push(l.price);
      makePrices.set(l.make, arr);
    }
  }
  const avgPriceByMake = Array.from(makePrices.entries()).map(([make, prices]) => ({
    make, avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length), count: prices.length,
  })).sort((a, b) => b.count - a.count).slice(0, 15);

  return {
    totalActive, listingsPerSource, listingsPerMake, listingsPerCity,
    dealTagDistribution, avgPriceByMake,
    recentScrapeLogs: [] as any[],
    cacheStats: cache.getStats(),
    _fallback: true,
  };
}

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET() {
  try {
    let totalActive = 0;
    try {
      totalActive = await db.listing.count({ where: { isActive: true, isDeleted: false } });
    } catch (dbErr) {
      console.warn('[API /admin/stats] DB count failed, using fallback:', (dbErr as Error).message);
      return NextResponse.json(buildStatsFromFallback());
    }

    if (totalActive === 0) {
      return NextResponse.json(buildStatsFromFallback());
    }

    const listingsPerSourceRaw = await db.listing.groupBy({
      by: ['sourceName'], where: { isActive: true, isDeleted: false },
      _count: { sourceName: true }, orderBy: { _count: { sourceName: 'desc' } },
    });
    const listingsPerSource = listingsPerSourceRaw.map((r) => ({ sourceName: r.sourceName, count: r._count.sourceName }));

    const listingsPerMakeRaw = await db.listing.groupBy({
      by: ['make'], where: { isActive: true, isDeleted: false },
      _count: { make: true }, orderBy: { _count: { make: 'desc' } }, take: 15,
    });
    const listingsPerMake = listingsPerMakeRaw.map((r) => ({ make: r.make, count: r._count.make }));

    const listingsPerCityRaw = await db.listing.groupBy({
      by: ['city'], where: { isActive: true, isDeleted: false, city: { not: null } },
      _count: { city: true }, orderBy: { _count: { city: 'desc' } }, take: 10,
    });
    const listingsPerCity = listingsPerCityRaw.filter((r) => r.city !== null).map((r) => ({ city: r.city as string, count: r._count.city }));

    const dealTagDistRaw = await db.listing.groupBy({
      by: ['dealTag'], where: { isActive: true, isDeleted: false, dealTag: { not: null } },
      _count: { dealTag: true }, orderBy: { _count: { dealTag: 'desc' } },
    });
    const dealTagDistribution = dealTagDistRaw.filter((r) => r.dealTag !== null).map((r) => ({ tag: r.dealTag as string, count: r._count.dealTag }));

    const avgPriceByMakeRaw = await db.listing.groupBy({
      by: ['make'], where: { isActive: true, isDeleted: false },
      _avg: { price: true }, _count: { make: true }, orderBy: { _count: { make: 'desc' } }, take: 15,
    });
    const avgPriceByMake = avgPriceByMakeRaw.map((r) => ({ make: r.make, avgPrice: Math.round(r._avg.price ?? 0), count: r._count.make }));

    let recentScrapeLogs: any[] = [];
    try {
      const logs = await db.scrapeLog.findMany({ orderBy: { startTime: 'desc' }, take: 20 });
      recentScrapeLogs = logs.map((log) => ({
        id: log.id, sourceName: log.sourceName,
        startTime: new Date(log.startTime).toISOString(),
        endTime: log.endTime ? new Date(log.endTime).toISOString() : null,
        status: log.status, itemsFound: log.itemsFound, itemsSaved: log.itemsSaved,
        errorMsg: log.errorMsg, durationMs: log.durationMs,
      }));
    } catch (e) { /* ScrapeLog table may not exist */ }

    const cacheStats = cache.getStats();

    return NextResponse.json({
      totalActive, listingsPerSource, listingsPerMake, listingsPerCity,
      dealTagDistribution, avgPriceByMake, recentScrapeLogs, cacheStats,
    });
  } catch (error) {
    console.error('[API /admin/stats] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
