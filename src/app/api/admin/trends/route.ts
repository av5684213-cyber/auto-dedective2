import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/admin/trends ───────────────────────────────────────────────
//
// Returns price trends per make for the dashboard chart.
// Auth: protected by middleware.

export async function GET() {
  try {
    // Marka bazlı ortalama fiyat + ilan sayısı
    let makeStats: any[] = []
    try {
      makeStats = await db.listing.groupBy({
        by: ['make'],
        where: { isActive: true, isDeleted: false },
        _avg: { price: true },
        _count: { make: true },
        orderBy: { _count: { make: 'desc' } },
        take: 15,
      })
    } catch (e) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Kaynak bazlı dağılım
    let sourceStats: any[] = []
    try {
      sourceStats = await db.listing.groupBy({
        by: ['sourceName'],
        where: { isActive: true },
        _count: { sourceName: true },
        _avg: { price: true },
      })
    } catch {}

    // Deal tag dağılımı
    let dealStats: any[] = []
    try {
      dealStats = await db.listing.groupBy({
        by: ['dealTag'],
        where: { isActive: true, dealTag: { not: null } },
        _count: { dealTag: true },
      })
    } catch {}

    // Yıl bazlı dağılım
    let yearStats: any[] = []
    try {
      yearStats = await db.listing.groupBy({
        by: ['year'],
        where: { isActive: true },
        _count: { year: true },
        _avg: { price: true },
        orderBy: { year: 'desc' },
        take: 10,
      })
    } catch {}

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
