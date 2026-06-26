// Web Push gönderimi — VAPID + web-push paketi
// VAPID_PRIVATE_KEY veya NEXT_PUBLIC_VAPID_PUBLIC_KEY yoksa no-op.

import webpush from 'web-push'

let _configured = false
function configure() {
  if (_configured) return
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:info@otodedektif.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  _configured = true
}

export interface PushSubscriptionRow {
  endpoint: string
  p256dhKey: string
  authKey: string
}

export interface AlertPushData {
  subscription: PushSubscriptionRow
  title: string
  body: string
  url: string
  icon?: string | null
}

export async function sendAlertPush({ subscription, title, body, url, icon }: AlertPushData): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log('[push] VAPID keyleri yok — push atlandı')
    return { ok: false, error: 'VAPID missing' }
  }

  configure()

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dhKey,
      auth: subscription.authKey,
    },
  }

  const payload = JSON.stringify({
    title,
    body,
    url,
    icon: icon || '/icon.png',
    badge: '/badge.png',
    tag: 'otodedektif-alert',
    requireInteraction: false,
    data: { url },
  })

  try {
    await webpush.sendNotification(pushSubscription, payload, {
      TTL: 60 * 60 * 24, // 24 saat
      urgency: 'normal',
    })
    return { ok: true }
  } catch (e: any) {
    // 410 Gone / 404 → subscription artık geçersiz
    if (e?.statusCode === 410 || e?.statusCode === 404) {
      console.warn(`[push] Subscription expired (${e.statusCode}): ${subscription.endpoint.slice(0, 60)}...`)
      return { ok: false, error: 'subscription_expired' }
    }
    console.error('[push] Error:', e?.message || e)
    return { ok: false, error: String(e?.message || e) }
  }
}

/**
 * Süresi dolmuş push subscription'ları temizle.
 * Cron her gece çağırır.
 */
export async function cleanupExpiredSubscriptions(endpoints: string[]): Promise<number> {
  if (!endpoints.length) return 0
  // Prisma ile silme işlemi çağıran tarafta yapılır
  // Bu fonksiyon sadece endpoint listesi döner
  return endpoints.length
}
