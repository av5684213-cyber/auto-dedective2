import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'
import { ADAPTER_STATUSES } from '@/lib/adapters'

// ── GET /api/admin/data-quality — özet istatistikler + anomali listesi ────

export async function GET(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1) Adaptör durumları — son ScrapeLog kayıtları
  const recentLogs = await db.scrapeLog.findMany({
    orderBy: { startTime: 'desc' },
    take: 200,
  })

  const adapterStats = ADAPTER_STATUSES.map((adapter) => {
    const adapterLogs = recentLogs.filter((l) => l.sourceName === adapter.name)
    const lastLog = adapterLogs[0]
    const totalRuns = adapterLogs.length
    const failedRuns = adapterLogs.filter((l) => l.status === 'failed').length
    const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0
    const lastRun = lastLog?.startTime ?? null
    const lastStatus = lastLog?.status ?? null
    return {
      name: adapter.name,
      displayName: adapter.displayName,
      configuredStatus: adapter.status,
      note: adapter.note,
      lastRun,
      lastStatus,
      totalRuns,
      failedRuns,
      errorRate: Math.round(errorRate * 10) / 10,
    }
  })

  // 2) Eşleşme durumu dağılımı
  const matchStatusGroups = await db.listing.groupBy({
    by: ['matchStatus'],
    _count: true,
  })
  const totalListings = matchStatusGroups.reduce((s, g) => s + g._count, 0)
  const matchDistribution = {
    matched: 0,
    unmatched: 0,
    manual_review: 0,
    null: 0,
  }
  for (const g of matchStatusGroups) {
    const key = (g.matchStatus ?? 'null') as keyof typeof matchDistribution
    matchDistribution[key] = g._count
  }

  // 3) Fiyat anomali tespiti — PriceHistory'de ardışık kayıtlar arasında
  //    %30'dan fazla değişiklik olan ilanlar
  const listingsWithHistory = await db.listing.findMany({
    where: { isActive: true },
    select: {
      id: true, make: true, model: true, year: true, price: true,
      priceHistory: { orderBy: { recordedAt: 'asc' } },
    },
    take: 5000,
  })

  const ANOMALY_THRESHOLD = 0.30
  const anomalies: Array<{
    listingId: string
    make: string
    model: string
    year: number
    currentPrice: number
    previousPrice: number
    changePercent: number
  }> = []

  for (const listing of listingsWithHistory) {
    const history = listing.priceHistory
    if (history.length < 2) continue

    // Son iki kaydı karşılaştır
    const last = history[history.length - 1]
    const prev = history[history.length - 2]
    if (prev.price <= 0) continue

    const change = Math.abs((last.price - prev.price) / prev.price)
    if (change >= ANOMALY_THRESHOLD) {
      anomalies.push({
        listingId: listing.id,
        make: listing.make,
        model: listing.model,
        year: listing.year,
        currentPrice: last.price,
        previousPrice: prev.price,
        changePercent: Math.round(change * 1000) / 10,
      })
    }
  }

  anomalies.sort((a, b) => b.changePercent - a.changePercent)

  return NextResponse.json({
    adapters: adapterStats,
    matchDistribution: {
      ...matchDistribution,
      total: totalListings,
      matchedPct: totalListings > 0 ? Math.round((matchDistribution.matched / totalListings) * 1000) / 10 : 0,
      unmatchedPct: totalListings > 0 ? Math.round((matchDistribution.unmatched / totalListings) * 1000) / 10 : 0,
      manualReviewPct: totalListings > 0 ? Math.round((matchDistribution.manual_review / totalListings) * 1000) / 10 : 0,
    },
    anomalies: anomalies.slice(0, 50),
    anomaliesTotal: anomalies.length,
  })
}
