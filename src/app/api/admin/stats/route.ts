import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/services/cache';

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Total active listings
    const totalActive = await db.listing.count({
      where: { isActive: true, isDeleted: false },
    });

    // Listings per source
    const listingsPerSourceRaw = await db.listing.groupBy({
      by: ['sourceName'],
      where: { isActive: true, isDeleted: false },
      _count: { sourceName: true },
      orderBy: { _count: { sourceName: 'desc' } },
    });
    const listingsPerSource = listingsPerSourceRaw.map((r) => ({
      sourceName: r.sourceName,
      count: r._count.sourceName,
    }));

    // Listings per make (top 15)
    const listingsPerMakeRaw = await db.listing.groupBy({
      by: ['make'],
      where: { isActive: true, isDeleted: false },
      _count: { make: true },
      orderBy: { _count: { make: 'desc' } },
      take: 15,
    });
    const listingsPerMake = listingsPerMakeRaw.map((r) => ({
      make: r.make,
      count: r._count.make,
    }));

    // Listings per city (top 10)
    const listingsPerCityRaw = await db.listing.groupBy({
      by: ['city'],
      where: { isActive: true, isDeleted: false, city: { not: null } },
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: 10,
    });
    const listingsPerCity = listingsPerCityRaw
      .filter((r) => r.city !== null)
      .map((r) => ({
        city: r.city as string,
        count: r._count.city,
      }));

    // Deal tag distribution
    const dealTagDistRaw = await db.listing.groupBy({
      by: ['dealTag'],
      where: { isActive: true, isDeleted: false, dealTag: { not: null } },
      _count: { dealTag: true },
      orderBy: { _count: { dealTag: 'desc' } },
    });
    const dealTagDistribution = dealTagDistRaw
      .filter((r) => r.dealTag !== null)
      .map((r) => ({
        tag: r.dealTag as string,
        count: r._count.dealTag,
      }));

    // Average price by make (top 15 by listing count)
    const avgPriceByMakeRaw = await db.listing.groupBy({
      by: ['make'],
      where: { isActive: true, isDeleted: false },
      _avg: { price: true },
      _count: { make: true },
      orderBy: { _count: { make: 'desc' } },
      take: 15,
    });
    const avgPriceByMake = avgPriceByMakeRaw.map((r) => ({
      make: r.make,
      avgPrice: Math.round(r._avg.price ?? 0),
      count: r._count.make,
    }));

    // Recent scrape logs (last 20)
    const recentScrapeLogs = await db.scrapeLog.findMany({
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    // Cache stats
    const cacheStats = cache.getStats();

    return NextResponse.json({
      totalActive,
      listingsPerSource,
      listingsPerMake,
      listingsPerCity,
      dealTagDistribution,
      avgPriceByMake,
      recentScrapeLogs: recentScrapeLogs.map((log) => ({
        id: log.id,
        sourceName: log.sourceName,
        startTime: new Date(log.startTime).toISOString(),
        endTime: log.endTime ? new Date(log.endTime).toISOString() : null,
        status: log.status,
        itemsFound: log.itemsFound,
        itemsSaved: log.itemsSaved,
        errorMsg: log.errorMsg,
        durationMs: log.durationMs,
      })),
      cacheStats,
    });
  } catch (error) {
    console.error('[API /admin/stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
