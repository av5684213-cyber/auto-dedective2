import { db } from '@/lib/db'
import { ADAPTER_STATUSES } from '@/lib/adapters'

// ── Admin: Veri Kalitesi Paneli ───────────────────────────────────────────

export default async function DataQualityPage() {
  // 1) Adaptör durumları
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
    return {
      name: adapter.name,
      displayName: adapter.displayName,
      configuredStatus: adapter.status,
      note: adapter.note,
      lastRun: lastLog?.startTime ?? null,
      lastStatus: lastLog?.status ?? null,
      totalRuns,
      failedRuns,
      errorRate: Math.round(errorRate * 10) / 10,
    }
  })

  // 2) Eşleşme dağılımı
  const matchGroups = await db.listing.groupBy({
    by: ['matchStatus'],
    _count: true,
  })
  const totalListings = matchGroups.reduce((s, g) => s + g._count, 0)
  const matchDist: Record<string, number> = { matched: 0, unmatched: 0, manual_review: 0, null: 0 }
  for (const g of matchGroups) {
    matchDist[g.matchStatus ?? 'null'] = g._count
  }

  // 3) Fiyat anomalileri
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
    listingId: string; make: string; model: string; year: number
    currentPrice: number; previousPrice: number; changePercent: number
  }> = []
  for (const l of listingsWithHistory) {
    if (l.priceHistory.length < 2) continue
    const last = l.priceHistory[l.priceHistory.length - 1]
    const prev = l.priceHistory[l.priceHistory.length - 2]
    if (prev.price <= 0) continue
    const change = Math.abs((last.price - prev.price) / prev.price)
    if (change >= ANOMALY_THRESHOLD) {
      anomalies.push({
        listingId: l.id, make: l.make, model: l.model, year: l.year,
        currentPrice: last.price, previousPrice: prev.price,
        changePercent: Math.round(change * 1000) / 10,
      })
    }
  }
  anomalies.sort((a, b) => b.changePercent - a.changePercent)

  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    planned: 'bg-blue-100 text-blue-800',
    blocked: 'bg-red-100 text-red-800',
    unreachable: 'bg-yellow-100 text-yellow-800',
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Veri Kalitesi Paneli</h1>
        <p className="text-sm text-muted-foreground">
          Adaptör sağlığı, eşleşme durumu ve fiyat anomalileri.
        </p>
      </header>

      {/* Eşleşme dağılımı */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Eşleşme Durumu Dağılımı</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/30 p-4 rounded">
            <p className="text-xs text-muted-foreground">Toplam</p>
            <p className="text-2xl font-bold">{totalListings.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <p className="text-xs text-green-700">Matched</p>
            <p className="text-2xl font-bold text-green-700">{matchDist.matched}</p>
            <p className="text-xs text-green-700">
              {totalListings > 0 ? (matchDist.matched / totalListings * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded">
            <p className="text-xs text-yellow-700">Manual Review</p>
            <p className="text-2xl font-bold text-yellow-700">{matchDist.manual_review}</p>
            <p className="text-xs text-yellow-700">
              {totalListings > 0 ? (matchDist.manual_review / totalListings * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded">
            <p className="text-xs text-red-700">Unmatched</p>
            <p className="text-2xl font-bold text-red-700">{matchDist.unmatched}</p>
            <p className="text-xs text-red-700">
              {totalListings > 0 ? (matchDist.unmatched / totalListings * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      </section>

      {/* Adaptör durumları */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Adaptör Durumları</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Adaptör</th>
                <th className="p-2 text-left">Yapılandırma</th>
                <th className="p-2 text-left">Son Çalışma</th>
                <th className="p-2 text-left">Son Durum</th>
                <th className="p-2 text-right">Çalışma</th>
                <th className="p-2 text-right">Hata Oranı</th>
                <th className="p-2 text-left">Not</th>
              </tr>
            </thead>
            <tbody>
              {adapterStats.map((a) => (
                <tr key={a.name} className="border-b last:border-0">
                  <td className="p-2 font-medium">{a.displayName}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[a.configuredStatus] || ''}`}>
                      {a.configuredStatus}
                    </span>
                  </td>
                  <td className="p-2 text-xs">
                    {a.lastRun ? new Date(a.lastRun).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td className="p-2 text-xs">{a.lastStatus || '—'}</td>
                  <td className="p-2 text-right text-xs">{a.totalRuns}</td>
                  <td className="p-2 text-right text-xs">
                    <span className={a.errorRate > 50 ? 'text-red-600 font-medium' : ''}>
                      {a.errorRate}%
                    </span>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground max-w-xs truncate">
                    {a.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fiyat anomalileri */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">
          Fiyat Anomalileri (≥%30 değişim) — {anomalies.length} ilan
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">İlan</th>
                <th className="p-2 text-right">Önceki Fiyat</th>
                <th className="p-2 text-right">Yeni Fiyat</th>
                <th className="p-2 text-right">Değişim</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.slice(0, 30).map((a) => (
                <tr key={a.listingId} className="border-b last:border-0">
                  <td className="p-2 text-xs">
                    {a.make} {a.model} ({a.year})
                  </td>
                  <td className="p-2 text-right text-xs">
                    {a.previousPrice.toLocaleString('tr-TR')} ₺
                  </td>
                  <td className="p-2 text-right text-xs">
                    {a.currentPrice.toLocaleString('tr-TR')} ₺
                  </td>
                  <td className="p-2 text-right text-xs">
                    <span className={a.changePercent > 50 ? 'text-red-600 font-medium' : 'text-yellow-700'}>
                      %{a.changePercent}
                    </span>
                  </td>
                </tr>
              ))}
              {anomalies.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Anomali tespit edilmedi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
