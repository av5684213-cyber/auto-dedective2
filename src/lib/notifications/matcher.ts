// Alert matching engine
// Verilen listing'leri aktif alert'lere karşı eşleştirir,
// uygun kanallara paralel bildirim gönderir, dedupe yapar.
//
// Cron her gece ve /api/alerts/match (scraper secret ile) bu modülü çağırır.

import { db } from '@/lib/db'
import { sendAlertEmail } from './email'
import { sendAlertPush } from './push'
import { sendAlertTelegram } from './telegram'

interface ListingLike {
  id: string
  make: string
  model: string
  year: number
  price: number
  mileageKm?: number | null
  fuelType?: string | null
  transmission?: string | null
  bodyType?: string | null
  city?: string | null
  sellerType?: string | null
  dealTag?: string | null
  imageUrl?: string | null
  sourceUrl: string
  firstSeenAt?: Date
}

interface SearchFilters {
  make?: string
  model?: string
  yearMin?: number
  yearMax?: number
  priceMin?: number
  priceMax?: number
  mileageMax?: number
  fuelType?: string
  transmission?: string
  bodyType?: string
  city?: string
  sellerType?: string
  dealTag?: string[] | string
}

function matchesFilters(listing: ListingLike, filters: SearchFilters): boolean {
  if (filters.make && listing.make.toLowerCase() !== filters.make.toLowerCase()) return false
  if (filters.model && !listing.model.toLowerCase().includes(filters.model.toLowerCase())) return false
  if (filters.yearMin && listing.year < filters.yearMin) return false
  if (filters.yearMax && listing.year > filters.yearMax) return false
  if (filters.priceMin && listing.price < filters.priceMin) return false
  if (filters.priceMax && listing.price > filters.priceMax) return false
  if (filters.mileageMax && (listing.mileageKm ?? 0) > filters.mileageMax) return false
  if (filters.fuelType && listing.fuelType !== filters.fuelType) return false
  if (filters.transmission && listing.transmission !== filters.transmission) return false
  if (filters.bodyType && listing.bodyType !== filters.bodyType) return false
  if (filters.city && listing.city !== filters.city) return false
  if (filters.sellerType && listing.sellerType !== filters.sellerType) return false
  if (filters.dealTag) {
    const tags = Array.isArray(filters.dealTag) ? filters.dealTag : [filters.dealTag]
    if (!listing.dealTag || !tags.includes(listing.dealTag)) return false
  }
  return true
}

function parseChannels(channels: string, notifyEmail: boolean, notifyPush: boolean): string[] {
  // Yeni 'channels' alanı: önce JSON array dene, olmazsa comma-separated dene
  if (channels) {
    // JSON array dene
    try {
      const parsed = JSON.parse(channels)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      // JSON değil — comma-separated dene
      const commaParsed = channels.split(',').map(s => s.trim()).filter(Boolean)
      if (commaParsed.length > 0) return commaParsed
    }
  }
  // Backward compat: notifyEmail/notifyPush'tan türet
  const result: string[] = []
  if (notifyEmail) result.push('email')
  if (notifyPush) result.push('push')
  return result
}

export interface MatchResult {
  totalListings: number
  totalAlerts: number
  matchedPairs: number
  sentEmail: number
  sentPush: number
  sentTelegram: number
  errors: string[]
}

/**
 * Aktif alert'leri verilen ilan listesine karşı eşleştir ve bildirim gönder.
 * Hem cron hem /api/alerts/match kullanır.
 *
 * @param listings Eşleştirilecek ilan listesi
 * @param opts.sinceAlertId Sadece belirli bir alert'i test et (test amaçlı)
 * @param opts.dryRun Bildirim gönderme, sadece eşleşmeleri say
 */
export async function runAlertMatching(
  listings: ListingLike[],
  opts: { dryRun?: boolean } = {}
): Promise<MatchResult> {
  const result: MatchResult = {
    totalListings: listings.length,
    totalAlerts: 0,
    matchedPairs: 0,
    sentEmail: 0,
    sentPush: 0,
    sentTelegram: 0,
    errors: [],
  }

  if (!listings.length) return result

  // Tüm aktif alert'leri çek (user + push subs + telegram conn ile)
  const alerts = await db.savedSearch.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  })
  result.totalAlerts = alerts.length
  if (!alerts.length) return result

  // Telegram bağlantılarını topluca çek
  const userIds = alerts.map(a => a.userId)
  const [telegramConns, pushSubs] = await Promise.all([
    db.telegramConnection.findMany({ where: { userId: { in: userIds } } }),
    db.pushSubscription.findMany({ where: { userId: { in: userIds } } }),
  ])
  const telegramByUserId = new Map(telegramConns.map(t => [t.userId, t]))
  const pushByUserId = new Map<string, typeof pushSubs>()
  for (const p of pushSubs) {
    if (!pushByUserId.has(p.userId)) pushByUserId.set(p.userId, [])
    pushByUserId.get(p.userId)!.push(p)
  }

  // Önce dedupe — hangi (alertId, listingId) çiftleri zaten gönderilmiş?
  const listingIds = listings.map(l => l.id)
  const alreadyNotified = await db.alertNotification.findMany({
    where: {
      alertId: { in: alerts.map(a => a.id) },
      listingId: { in: listingIds },
    },
    select: { alertId: true, listingId: true },
  })
  const notifiedSet = new Set(alreadyNotified.map(n => `${n.alertId}:${n.listingId}`))

  const expiredPushEndpoints: string[] = []

  for (const listing of listings) {
    for (const alert of alerts) {
      if (notifiedSet.has(`${alert.id}:${listing.id}`)) continue

      let filters: SearchFilters = {}
      try {
        filters = JSON.parse(alert.filters)
      } catch {
        continue
      }

      if (!matchesFilters(listing, filters)) continue

      result.matchedPairs++
      const channels = parseChannels(alert.channels, alert.notifyEmail, alert.notifyPush)
      const sentChannels: string[] = []

      const tasks: Promise<void>[] = []

      // EMAIL
      if (channels.includes('email') && alert.user?.email) {
        tasks.push((async () => {
          const r = await sendAlertEmail({
            to: alert.user!.email,
            alertName: alert.name,
            listing: {
              id: listing.id,
              make: listing.make,
              model: listing.model,
              year: listing.year,
              price: listing.price,
              mileageKm: listing.mileageKm,
              city: listing.city,
              fuelType: listing.fuelType,
              transmission: listing.transmission,
              imageUrl: listing.imageUrl,
              sourceUrl: listing.sourceUrl,
              dealTag: listing.dealTag,
            },
          })
          if (r.ok) {
            result.sentEmail++
            sentChannels.push('email')
          } else if (r.error && !r.error.includes('RESEND_API_KEY')) {
            result.errors.push(`email ${alert.user!.email}: ${r.error}`)
          }
        })())
      }

      // PUSH (kullanıcının tüm cihazlarına)
      if (channels.includes('push')) {
        const userSubs = pushByUserId.get(alert.userId) || []
        for (const sub of userSubs) {
          tasks.push((async () => {
            const r = await sendAlertPush({
              subscription: {
                endpoint: sub.endpoint,
                p256dhKey: sub.p256dhKey,
                authKey: sub.authKey,
              },
              title: `Yeni ilan: ${listing.make} ${listing.model}`,
              body: `${listing.year} | ${listing.mileageKm ? new Intl.NumberFormat('tr-TR').format(listing.mileageKm) + ' km' : '?'} | ${new Intl.NumberFormat('tr-TR').format(listing.price)} ₺`,
              url: listing.sourceUrl,
              icon: listing.imageUrl,
            })
            if (r.ok) {
              result.sentPush++
              if (!sentChannels.includes('push')) sentChannels.push('push')
            } else if (r.error === 'subscription_expired') {
              expiredPushEndpoints.push(sub.endpoint)
            } else if (r.error && !r.error.includes('VAPID')) {
              result.errors.push(`push ${sub.endpoint.slice(0, 40)}: ${r.error}`)
            }
          })())
        }
      }

      // TELEGRAM
      if (channels.includes('telegram')) {
        const tg = telegramByUserId.get(alert.userId)
        if (tg) {
          tasks.push((async () => {
            const r = await sendAlertTelegram({
              chatId: tg.chatId,
              alertName: alert.name,
              listing: {
                id: listing.id,
                make: listing.make,
                model: listing.model,
                year: listing.year,
                price: listing.price,
                mileageKm: listing.mileageKm,
                city: listing.city,
                fuelType: listing.fuelType,
                transmission: listing.transmission,
                imageUrl: listing.imageUrl,
                sourceUrl: listing.sourceUrl,
                dealTag: listing.dealTag,
              },
            })
            if (r.ok) {
              result.sentTelegram++
              sentChannels.push('telegram')
            } else if (r.error && !r.error.includes('TELEGRAM_BOT_TOKEN')) {
              result.errors.push(`telegram ${tg.chatId}: ${r.error}`)
            }
          })())
        }
      }

      if (tasks.length > 0) {
        await Promise.allSettled(tasks)
      }

      // Bildirim gönderilmiş olarak işaretle (en az 1 kanaldan gitmiş olsun)
      if (sentChannels.length > 0 && !opts.dryRun) {
        try {
          await db.alertNotification.create({
            data: {
              alertId: alert.id,
              listingId: listing.id,
              channels: JSON.stringify(sentChannels),
            },
          })
          await db.savedSearch.update({
            where: { id: alert.id },
            data: {
              lastNotifiedAt: new Date(),
              lastCheckedAt: new Date(),
            },
          })
        } catch (e: any) {
          // unique constraint ihlali → zaten gönderilmiş, sorun değil
          if (!String(e?.message || '').includes('Unique constraint')) {
            result.errors.push(`dedupe insert: ${e?.message}`)
          }
        }
      }
    }
  }

  // Süresi dolmuş push subscription'ları sil
  if (expiredPushEndpoints.length > 0) {
    try {
      await db.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredPushEndpoints } },
      })
      console.log(`[alerts] Cleaned up ${expiredPushEndpoints.length} expired push subscriptions`)
    } catch (e) {
      console.error('[alerts] Failed to cleanup expired subscriptions:', e)
    }
  }

  return result
}

/**
 * Cron için: son X saatte eklenen tüm ilanları al, match çalıştır.
 */
export async function runCronAlertMatching(opts: { sinceHours?: number } = {}): Promise<MatchResult> {
  const sinceHours = opts.sinceHours ?? 24
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000)

  const recentListings = await db.listing.findMany({
    where: {
      firstSeenAt: { gte: since },
      isActive: true,
    },
    select: {
      id: true,
      make: true,
      model: true,
      year: true,
      price: true,
      mileageKm: true,
      fuelType: true,
      transmission: true,
      bodyType: true,
      city: true,
      sellerType: true,
      dealTag: true,
      imageUrl: true,
      sourceUrl: true,
      firstSeenAt: true,
    },
    take: 500, // batch limit — fazla yüklenmesin
  })

  console.log(`[alerts] Cron matching: ${recentListings.length} yeni ilan, son ${sinceHours} saatte`)
  return runAlertMatching(recentListings)
}
