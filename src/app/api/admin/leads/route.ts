import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

// ── GET /api/admin/leads — talep listesi ─────────────────────────────────

export async function GET(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined

  const where: Record<string, unknown> = {}
  if (status && status !== 'all') where.status = status

  const leads = await db.lead.findMany({
    where,
    include: {
      listing: { select: { id: true, make: true, model: true, year: true, price: true } },
      notes: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ leads, total: leads.length })
}

// ── POST /api/admin/leads — yeni talep veya not ekleme ───────────────────
//
// Body: { leadId?: string, name?: string, phone?: string, email?: string,
//        listingId?: string, message?: string, status?: string,
//        noteContent?: string }
// - leadId verilirse: mevcut talebe not ekleme veya durum güncelleme
// - leadId yoksa: yeni talep oluşturma

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { leadId, name, phone, email, listingId, message, status, noteContent } = body

  // Mevcut talebe not ekleme / durum güncelleme
  if (leadId) {
    if (noteContent) {
      const note = await db.leadNote.create({
        data: { leadId, content: String(noteContent) },
      })
      return NextResponse.json({ note })
    }
    if (status) {
      const updated = await db.lead.update({
        where: { id: leadId },
        data: { status: String(status) },
      })
      return NextResponse.json({ lead: updated })
    }
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Yeni talep oluşturma
  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone required' }, { status: 400 })
  }
  const lead = await db.lead.create({
    data: {
      name: String(name),
      phone: String(phone),
      email: email ? String(email) : null,
      listingId: listingId ? String(listingId) : null,
      message: message ? String(message) : null,
      status: status || 'new',
    },
  })
  return NextResponse.json({ lead }, { status: 201 })
}
