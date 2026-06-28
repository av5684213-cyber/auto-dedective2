import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

// ── GET /api/admin/sales-pipeline — ziyaret listesi ───────────────────────
//
// Query: status, city

export async function GET(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  const city = searchParams.get('city') || undefined

  const where: Record<string, unknown> = {}
  if (status && status !== 'all') where.status = status
  if (city && city !== 'all') where.city = city

  const visits = await db.salesVisit.findMany({
    where,
    include: {
      dealer: { select: { id: true, name: true, city: true, subscriptionPlan: true } },
    },
    orderBy: { visitDate: 'desc' },
    take: 200,
  })

  return NextResponse.json({ visits })
}

// ── POST — yeni ziyaret kaydı / durum güncelleme ─────────────────────────
//
// Body: { id?: string, dealerId?, galleryName?, city, contactName?, status?,
//        notes?, visitDate }
// - id verilirse: durum güncelleme
// - id yoksa: yeni kayıt

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, dealerId, galleryName, city, contactName, status, notes, visitDate } = body

  if (id) {
    // Güncelleme
    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = String(status)
    if (notes !== undefined) data.notes = notes ? String(notes) : null
    if (contactName !== undefined) data.contactName = contactName ? String(contactName) : null
    if (visitDate !== undefined) data.visitDate = new Date(visitDate)
    const updated = await db.salesVisit.update({ where: { id }, data })
    return NextResponse.json({ visit: updated })
  }

  // Yeni kayıt
  if (!city || !visitDate) {
    return NextResponse.json({ error: 'city, visitDate required' }, { status: 400 })
  }
  const visit = await db.salesVisit.create({
    data: {
      dealerId: dealerId || null,
      galleryName: galleryName ? String(galleryName) : null,
      city: String(city),
      contactName: contactName ? String(contactName) : null,
      status: status || 'visited',
      notes: notes ? String(notes) : null,
      visitDate: new Date(visitDate),
    },
  })
  return NextResponse.json({ visit }, { status: 201 })
}

// ── PATCH — durum güncelleme ──────────────────────────────────────────────

export async function PATCH(request: Request) {
  return POST(request)
}
