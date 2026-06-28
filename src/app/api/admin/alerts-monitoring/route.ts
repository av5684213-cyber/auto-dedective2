import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

// ── GET /api/admin/alerts-monitoring — bildirim sistemi özeti ─────────────

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1) Toplam aktif SavedSearch sayısı
  const totalSavedSearches = await db.savedSearch.count({
    where: { isActive: true },
  })

  // 2) Push abonelik sayısı (tekil kullanıcı)
  const totalPushSubscriptions = await db.pushSubscription.count()
  const uniquePushUsers = await db.pushSubscription.groupBy({
    by: ['userId'],
    _count: true,
  })

  // 3) Telegram bağlantı sayısı
  const totalTelegramConnections = await db.telegramConnection.count()

  // 4) AlertNotification — kanal bazlı dağılım
  //    channels alanı JSON array string: '["email","push"]'
  const allNotifications = await db.alertNotification.findMany({
    select: { id: true, channels: true, sentAt: true, alertId: true, listingId: true },
    orderBy: { sentAt: 'desc' },
    take: 5000,
  })

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
      // JSON parse hatası — skip
    }
  }

  // 5) Son 7 gün içindeki bildirimler (günlük dağılım)
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
    dailyBuckets.push({
      date: dayStart.toISOString().split('T')[0],
      count,
    })
  }

  // 6) Son 50 bildirimin detayı
  const recentDetail = allNotifications.slice(0, 50).map((n) => ({
    id: n.id,
    channels: (() => {
      try { return JSON.parse(n.channels || '[]') as string[] } catch { return [] }
    })(),
    sentAt: n.sentAt,
    alertId: n.alertId,
    listingId: n.listingId,
  }))

  return NextResponse.json({
    summary: {
      totalSavedSearches,
      totalPushSubscriptions,
      uniquePushUsers: uniquePushUsers.length,
      totalTelegramConnections,
      totalNotifications: allNotifications.length,
      channelCounts: { email: emailCount, push: pushCount, telegram: telegramCount },
    },
    dailyBuckets,
    recentNotifications: recentDetail,
  })
}
