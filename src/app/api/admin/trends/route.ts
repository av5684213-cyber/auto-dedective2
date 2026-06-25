import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { loadFallbackListings } from '@/lib/services/fallback-data'

// ── GET /api/admin/trends ───────────────────────────────────────────────
//
// Returns price trends per make for the dashboard chart.
// DB'de listing yoksa fallback data'dan hesaplar.

export async function GET() {
  try {
    // Önce DB'den çekmeyi dene
    let makeStats: any[] = []
    let sourceStats: any[] = []
    let dealStats: any[] = []
    let yearStats: any[] = []
    let dbWorked = false

    try {
      makeStats = await db.listing.groupBy({
        by: ['make'],
        where: { isActive: true, isDeleted: false },
        _avg: { price: true },
        _count: { make: true },
        orderBy: { _count: { make: 'desc' } },
        take: 15,
      })
      if (makeStats.length > 0) {
        dbWorked = true
        sourceStats = await db.listing.groupBy({
          by: ['sourceName'],
          where: { isActive: true },
          _count: { sourceName: true },
          _avg: { price: true },
        })
        dealStats = await db.listing.groupBy({
          by: ['dealTag'],
          where: { isActive: true, dealTag: { not: null } },
          _count: { dealTag: true },
        })
        yearStats = await db.listing.groupBy({
          by: ['year'],
          where: { isActive: true },
          _count: { year: true },
          _avg: { price: true },
          orderBy: { year: 'desc' },
          take: 10,
        })
      }
    } catch (e) {
      // DB çalışmıyor — fallback kullan
    }

    // DB boş/hata varsa fallback data'dan hesapla
    if (!dbWorked || makeStats.length === 0) {
      const fallback = loadFallbackListings()
      const activeListings = fallback.filter(l => l.isActive !== false && !l.isDeleted)

      // Marka bazlı
      const makeMap = new Map<string, { sum: number; count: number }>()
      for (const l of activeListings) {
        const cur = makeMap.get(l.make) || { sum: 0, count: 0 }
        cur.sum += l.price
        cur.count++
        makeMap.set(l.make, cur)
      }
      makeStats = Array.from(makeMap.entries())
        .map(([make, v]) => ({ make, _avg: { price: v.sum / v.count }, _count: { make: v.count } }))
        .sort((a, b) => b._count.make - a._count.make)
        .slice(0, 15)

      // Kaynak bazlı
      const sourceMap = new Map<string, { sum: number; count: number }>()
      for (const l of activeListings) {
        const cur = sourceMap.get(l.sourceName) || { sum: 0, count: 0 }
        cur.sum += l.price
        cur.count++
        sourceMap.set(l.sourceName, cur)
      }
      sourceStats = Array.from(sourceMap.entries())
        .map(([sourceName, v]) => ({ sourceName, _avg: { price: v.sum / v.count }, _count: { sourceName: v.count } }))

      // Deal tag bazlı
      const dealMap = new Map<string, number>()
      for (const l of activeListings) {
        if (l.dealTag) {
          dealMap.set(l.dealTag, (dealMap.get(l.dealTag) || 0) + 1)
        }
      }
      dealStats = Array.from(dealMap.entries())
        .map(([dealTag, count]) => ({ dealTag, _count: { dealTag: count } }))

      // Yıl bazlı
      const yearMap = new Map<number, { sum: number; count: number }>()
      for (const l of activeListings) {
        const cur = yearMap.get(l.year) || { sum: 0, count: 0 }
        cur.sum += l.price
        cur.count++
        yearMap.set(l.year, cur)
      }
      yearStats = Array.from(yearMap.entries())
        .map(([year, v]) => ({ year, _avg: { price: v.sum / v.count }, _count: { year: v.count } }))
        .sort((a, b) => b.year - a.year)
        .slice(0, 10)
    }

    const result = {
      makes: makeStats.map((m: any) => ({
        make: m.make,
        avgPrice: Math.round(m._avg.price ?? 0),
        count: m._count.make,
      })),
      sources: sourceStats.map((s: any) => ({
        source: s.sourceName,
        count: s._count.sourceName,
        avgPrice: Math.round(s._avg.price ?? 0),
      })),
      deals: dealStats.map((d: any) => ({
        tag: d.dealTag,
        count: d._count.dealTag,
      })),
      years: yearStats.map((y: any) => ({
        year: y.year,
        count: y._count.year,
        avgPrice: Math.round(y._avg.price ?? 0),
      })),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API /admin/trends] Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
