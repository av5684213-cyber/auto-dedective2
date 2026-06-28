import { db } from '@/lib/db'

// ── Admin: Bildirim/Alert Sistemi İzleme ──────────────────────────────────

export default async function AlertsMonitoringPage() {
  const [
    totalSavedSearches,
    totalPushSubscriptions,
    uniquePushUsers,
    totalTelegramConnections,
    allNotifications,
  ] = await Promise.all([
    db.savedSearch.count({ where: { isActive: true } }),
    db.pushSubscription.count(),
    db.pushSubscription.groupBy({ by: ['userId'], _count: true }),
    db.telegramConnection.count(),
    db.alertNotification.findMany({
      select: { id: true, channels: true, sentAt: true, alertId: true, listingId: true },
      orderBy: { sentAt: 'desc' },
      take: 5000,
    }),
  ])

  // Kanal sayımları
  let emailCount = 0
  let pushCount = 0
  let telegramCount = 0
  for (const n of allNotifications) {
    try {
      const channels = JSON.parse(n.channels || '[]') as string[]
      if (channels.includes('email')) emailCount++
      if (channels.includes('push')) pushCount++
      if (channels.includes('telegram')) telegramCount++
    } catch {
      // skip
    }
  }

  // Son 7 gün günlük dağılım
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentNotifications = allNotifications.filter((n) => new Date(n.sentAt) >= sevenDaysAgo)
  const dailyBuckets: Array<{ date: string; count: number }> = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const count = recentNotifications.filter((n) => {
      const d = new Date(n.sentAt)
      return d >= dayStart && d < dayEnd
    }).length
    dailyBuckets.push({ date: dayStart.toISOString().split('T')[0], count })
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Bildirim Sistemi İzleme</h1>
        <p className="text-sm text-muted-foreground">
          Alert altyapısı istatistikleri ve gönderim özeti.
        </p>
      </header>

      {/* Özet kartları */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Aktif Kayıtlı Arama</p>
          <p className="text-2xl font-bold">{totalSavedSearches}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Push Aboneliği</p>
          <p className="text-2xl font-bold">{totalPushSubscriptions}</p>
          <p className="text-xs text-muted-foreground">{uniquePushUsers.length} tekil kullanıcı</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Telegram Bağlantısı</p>
          <p className="text-2xl font-bold">{totalTelegramConnections}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Toplam Bildirim</p>
          <p className="text-2xl font-bold">{allNotifications.length}</p>
        </div>
      </section>

      {/* Kanal bazlı dağılım */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Kanal Bazlı Bildirim Dağılımı</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-xs text-blue-700">Email</p>
            <p className="text-2xl font-bold text-blue-700">{emailCount}</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <p className="text-xs text-green-700">Push</p>
            <p className="text-2xl font-bold text-green-700">{pushCount}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <p className="text-xs text-purple-700">Telegram</p>
            <p className="text-2xl font-bold text-purple-700">{telegramCount}</p>
          </div>
        </div>
      </section>

      {/* Son 7 gün */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Son 7 Gün Bildirim Dağılımı</h2>
        <div className="space-y-2">
          {dailyBuckets.map((b) => {
            const max = Math.max(...dailyBuckets.map((d) => d.count), 1)
            const width = (b.count / max) * 100
            return (
              <div key={b.date} className="flex items-center gap-3">
                <span className="text-xs w-24">{b.date}</span>
                <div className="flex-1 bg-muted/30 rounded h-6 overflow-hidden">
                  <div
                    className="bg-primary h-full flex items-center justify-end pr-2 text-xs text-primary-foreground"
                    style={{ width: `${Math.max(width, 5)}%` }}
                  >
                    {b.count > 0 && b.count}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Son bildirimler */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Son 50 Bildirim</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Tarih</th>
                <th className="p-2 text-left">Kanallar</th>
                <th className="p-2 text-left">Alert ID</th>
                <th className="p-2 text-left">İlan ID</th>
              </tr>
            </thead>
            <tbody>
              {allNotifications.slice(0, 50).map((n) => {
                let channels: string[] = []
                try { channels = JSON.parse(n.channels || '[]') as string[] } catch { /* */ }
                return (
                  <tr key={n.id} className="border-b last:border-0">
                    <td className="p-2 text-xs">{new Date(n.sentAt).toLocaleString('tr-TR')}</td>
                    <td className="p-2 text-xs">
                      {channels.map((c) => (
                        <span key={c} className="px-1.5 py-0.5 mr-1 rounded bg-muted text-xs">
                          {c}
                        </span>
                      ))}
                    </td>
                    <td className="p-2 text-xs font-mono">{n.alertId}</td>
                    <td className="p-2 text-xs font-mono">{n.listingId}</td>
                  </tr>
                )
              })}
              {allNotifications.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Bildirim kaydı yok.
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
