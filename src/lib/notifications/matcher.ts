// Alert matching engine — v2
// Verilen listing'leri aktif alert'lere karşı eşleştirir,
// uygun kanallara paralel bildirim gönderir, dedupe yapar.
//
// Desteklenen filtreler (kullanıcı alarm kurarken seçebilir):
//   1.  make (string | string[])              — tek veya çoklu marka
//   2.  model (string | string[])             — tek veya çoklu model
//   3.  trim (string)                         — trim detayı (içeren)
//   4.  yearMin / yearMax (number)
//   5.  priceMin / priceMax (number)
//   6.  mileageMin / mileageMax (number)
//   7.  fuelType (string | string[])          — Benzin/Dizel/LPG/Hibrit/Elektrik
//   8.  transmission (string | string[])
//   9.  bodyType (string | string[])          — Sedan/Hatchback/SUV/...
//  10.  color (string | string[])             — Renk
//  11.  colorExclude (string | string[])      — Hariç tutulan renkler
//  12.  city (string | string[])              — Şehir
//  13.  district (string | string[])          — İlçe
//  14.  sellerType (string | string[])        — Galeri/Sahibinden/...
//  15.  accidentStatus (string | string[])    — kazasiz/az_hasarli/orta_hasarli/agir_hasarli
//  16.  dealScoreMin (number 1-5)             — minimum yıldız puanı
//  17.  dealTag (string | string[])           — Harika Fırsat/İyi Fiyat/...
//
// Eşleştirme kuralları:
//   - Tek değer: eşitlik (case-insensitive)
//   - Çoklu değer: array'in elemanlarından herhangi birine eşitse geçer (OR mantığı)
//   - Boş/null filtre: o kriter yok sayılır (her ilan geçer)
//   - accidentStatus eşleşmesi: kullanıcı "kazasiz" seçerse sadece kazasiz ilanlar
//     kullanıcı ["kazasiz", "az_hasarli"] seçerse ikisinden biri yeterli

import { db } from '@/lib/db'
import { sendAlertEmail } from './email'
import { sendAlertPush } from './push'
import { sendAlertTelegram } from './telegram'

interface ListingLike {
  id: string
  make: string
  model: string
  trim?: string | null
  year: number
  price: number
  mileageKm?: number | null
  fuelType?: string | null
  transmission?: string | null
  bodyType?: string | null
  color?: string | null
  city?: string | null
  district?: string | null
  sellerType?: string | null
  accidentStatus?: string | null
  dealTag?: string | null
  dealScore?: number | null
  imageUrl?: string | null
  sourceUrl: string
  firstSeenAt?: Date
}

type MultiValue = string | string[] | undefined

interface SearchFilters {
  make?: MultiValue
  model?: MultiValue
  trim?: string
  yearMin?: number
  yearMax?: number
  priceMin?: number
  priceMax?: number
  mileageMin?: number
  mileageMax?: number
  fuelType?: MultiValue
  transmission?: MultiValue
  bodyType?: MultiValue
  color?: MultiValue
  colorExclude?: MultiValue
  city?: MultiValue
  district?: MultiValue
  sellerType?: MultiValue
  accidentStatus?: MultiValue
  dealScoreMin?: number
  dealTag?: MultiValue
}

/**
 * Tek değer veya array olarak gelen filtreyi normalize eder.
 * Dönüş: string[] (boşsa [])
 */
function toArray(v: MultiValue): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(s => String(s).trim().toLowerCase()).filter(Boolean)
  return [String(v).trim().toLowerCase()]
}

/**
 * Listing'in alanı, verilen filter array'inden herhangi birine eşit mi? (OR)
 * Boş array → filtre yok → true döner.
 * Büyük/küçük harf duyarsız.
 */
function matchesOneOf(listingValue: string | null | undefined, filterValue: MultiValue): boolean {
  const arr = toArray(filterValue)
  if (arr.length === 0) return true // filtre yok
  if (!listingValue) return false // listing'te değer yok ama filter var
  const lv = listingValue.toLowerCase()
  return arr.includes(lv)
}

/**
 * Listing'in alanı, verilen filter array'inden hiçbirine eşit değil mi? (NOT IN)
 * Boş array → hariç tutma yok → true döner.
 */
function matchesNoneOf(listingValue: string | null | undefined, filterValue: MultiValue): boolean {
  const arr = toArray(filterValue)
  if (arr.length === 0) return true // hariç tutma yok
  if (!listingValue) return true // listing'te değer yok, hariç tutmaya gerek yok
  const lv = listingValue.toLowerCase()
  return !arr.includes(lv)
}

/**
 * String contains (case-insensitive). Trim ve model detayı için kullanılır.
 */
function containsText(listingValue: string | null | undefined, filterValue: string | undefined): boolean {
  if (!filterValue) return true
  if (!listingValue) return false
  return listingValue.toLowerCase().includes(filterValue.toLowerCase())
}

function matchesFilters(listing: ListingLike, filters: SearchFilters): boolean {
  // 1. Marka (tek veya çoklu)
  if (!matchesOneOf(listing.make, filters.make)) return false

  // 2. Model (tek veya çoklu — exact match)
  if (!matchesOneOf(listing.model, filters.model)) return false

  // 3. Trim (contains)
  if (!containsText(listing.trim, filters.trim)) return false

  // 4. Yıl aralığı
  if (filters.yearMin && listing.year < filters.yearMin) return false
  if (filters.yearMax && listing.year > filters.yearMax) return false

  // 5. Fiyat aralığı
  if (filters.priceMin && listing.price < filters.priceMin) return false
  if (filters.priceMax && listing.price > filters.priceMax) return false

  // 6. KM aralığı
  const km = listing.mileageKm ?? 0
  if (filters.mileageMin && km < filters.mileageMin) return false
  if (filters.mileageMax && km > filters.mileageMax) return false

  // 7. Yakıt
  if (!matchesOneOf(listing.fuelType, filters.fuelType)) return false

  // 8. Vites
  if (!matchesOneOf(listing.transmission, filters.transmission)) return false

  // 9. Kasa tipi
  if (!matchesOneOf(listing.bodyType, filters.bodyType)) return false

  // 10. Renk (contains — "Beyaz" filtresi "Beyaz" ve "Beyaz/Siyah" ikisini de yakalar)
  if (filters.color) {
    const arr = toArray(filters.color)
    if (arr.length > 0) {
      if (!listing.color) return false
      const lv = listing.color.toLowerCase()
      const matched = arr.some(c => lv.includes(c))
      if (!matched) return false
    }
  }

  // 11. Renk hariç tutma
  if (!matchesNoneOf(listing.color, filters.colorExclude)) return false

  // 12. Şehir
  if (!matchesOneOf(listing.city, filters.city)) return false

  // 13. İlçe
  if (!matchesOneOf(listing.district, filters.district)) return false

  // 14. Satıcı tipi
  if (!matchesOneOf(listing.sellerType, filters.sellerType)) return false

  // 15. Kazalı durumu
  if (!matchesOneOf(listing.accidentStatus, filters.accidentStatus)) return false

  // 16. DealScore minimum (1-5 yıldız)
  // dealScore DB'de 0-100 arası float, 5 yıldıza normalize: score/20
  if (filters.dealScoreMin && filters.dealScoreMin > 0) {
    if (!listing.dealScore) return false
    const stars = listing.dealScore / 20
    if (stars < filters.dealScoreMin) return false
  }

  // 17. Fırsat etiketi
  if (!matchesOneOf(listing.dealTag, filters.dealTag)) return false

  return true
}

function parseChannels(channels: string, notifyEmail: boolean, notifyPush: boolean): string[] {
  if (channels) {
    try {
      const parsed = JSON.parse(channels)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      const commaParsed = channels.split(',').map(s => s.trim()).filter(Boolean)
      if (commaParsed.length > 0) return commaParsed
    }
  }
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

      const tasks: Promise<void>[] = []

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
          } else if (r.error && !r.error.includes('RESEND_API_KEY')) {
            result.errors.push(`email ${alert.user!.email}: ${r.error}`)
          }
        })())
      }

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
            } else if (r.error === 'subscription_expired') {
              expiredPushEndpoints.push(sub.endpoint)
            } else if (r.error && !r.error.includes('VAPID')) {
              result.errors.push(`push ${sub.endpoint.slice(0, 40)}: ${r.error}`)
            }
          })())
        }
      }

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
            } else if (r.error && !r.error.includes('TELEGRAM_BOT_TOKEN')) {
              result.errors.push(`telegram ${tg.chatId}: ${r.error}`)
            }
          })())
        }
      }

      if (tasks.length > 0) {
        await Promise.allSettled(tasks)
      }

      if (!opts.dryRun) {
        try {
          await db.alertNotification.create({
            data: {
              alertId: alert.id,
              listingId: listing.id,
              channels: JSON.stringify(channels),
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
          if (!String(e?.message || '').includes('Unique constraint')) {
            result.errors.push(`dedupe insert: ${e?.message}`)
          }
        }
      }
    }
  }

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
      trim: true,
      year: true,
      price: true,
      mileageKm: true,
      fuelType: true,
      transmission: true,
      bodyType: true,
      color: true,
      city: true,
      district: true,
      sellerType: true,
      accidentStatus: true,
      dealTag: true,
      dealScore: true,
      imageUrl: true,
      sourceUrl: true,
      firstSeenAt: true,
    },
    take: 500,
  })

  console.log(`[alerts] Cron matching: ${recentListings.length} yeni ilan, son ${sinceHours} saatte`)
  return runAlertMatching(recentListings)
}

// FILTER_OPTIONS — ayrı dosyaya taşındı (filter-options.ts)
// Sebep: client component'ler (AlertManager) bunu import eder,
// matcher.ts ise web-push import ettiği için client bundle'a giremez.
export { FILTER_OPTIONS } from './filter-options'
