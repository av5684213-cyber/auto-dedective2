import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

// ── GET /api/admin/dealers — galeri listesi ──────────────────────────────
//
// Query: status, plan, overdue (1: ödemesi gecikenler)

export async function GET(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  const plan = searchParams.get('plan') || undefined
  const overdue = searchParams.get('overdue') === '1'

  const where: Record<string, unknown> = {}
  if (status && status !== 'all') where.subscriptionStatus = status
  if (plan && plan !== 'all') where.subscriptionPlan = plan
  if (overdue) {
    where.subscriptionStatus = 'active'
    where.nextPaymentDue = { lt: new Date() }
  }

  const dealers = await db.dealer.findMany({
    where,
    include: {
      _count: { select: { listings: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Aktif ilan sayısı (isActive=true)
  const dealersWithActiveCount = await Promise.all(
    dealers.map(async (d) => {
      const activeListings = await db.listing.count({
        where: { dealerId: d.id, isActive: true, isDeleted: false },
      })
      return { ...d, activeListingCount: activeListings, totalListingCount: d._count.listings }
    }),
  )

  return NextResponse.json({ dealers: dealersWithActiveCount })
}

// ── POST /api/admin/dealers — yeni galeri ────────────────────────────────
//
// Body: { name, city, phone, email?, subscriptionPlan?, subscriptionPrice?,
//        subscriptionStatus?, lastPaymentDate?, nextPaymentDue? }

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, city, phone, email, subscriptionPlan, subscriptionPrice,
          subscriptionStatus, lastPaymentDate, nextPaymentDue } = body

  if (!name || !city || !phone) {
    return NextResponse.json({ error: 'name, city, phone required' }, { status: 400 })
  }

  const dealer = await db.dealer.create({
    data: {
      name: String(name),
      city: String(city),
      phone: String(phone),
      email: email ? String(email) : null,
      subscriptionPlan: subscriptionPlan || 'none',
      subscriptionPrice: subscriptionPrice ? Number(subscriptionPrice) : null,
      subscriptionStatus: subscriptionStatus || 'inactive',
      lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
      nextPaymentDue: nextPaymentDue ? new Date(nextPaymentDue) : null,
    },
  })
  return NextResponse.json({ dealer }, { status: 201 })
}
