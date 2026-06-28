import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

// ── GET /api/admin/listings — filtrelenebilir ilan listesi ───────────────
//
// Query: source, matchStatus, q, page, limit, dealerId

export async function GET(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || undefined
  const matchStatus = searchParams.get('matchStatus') || undefined
  const q = searchParams.get('q') || undefined
  const dealerId = searchParams.get('dealerId') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (source && source !== 'all') where.sourceName = source
  if (matchStatus && matchStatus !== 'all') where.matchStatus = matchStatus
  if (dealerId) where.dealerId = dealerId
  if (q) {
    where.OR = [
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [listings, total] = await Promise.all([
    db.listing.findMany({
      where,
      select: {
        id: true, sourceName: true, make: true, model: true, year: true,
        price: true, city: true, isActive: true, isDeleted: true,
        matchStatus: true, matchConfidence: true, variantId: true,
        dealerId: true, lastSeenAt: true,
        variant: { select: { id: true, name: true, series: { select: { name: true, brand: { select: { name: true } } } } } },
      },
      orderBy: { lastSeenAt: 'desc' },
      skip, take: limit,
    }),
    db.listing.count({ where }),
  ])

  return NextResponse.json({ listings, total, page, limit, totalPages: Math.ceil(total / limit) })
}
