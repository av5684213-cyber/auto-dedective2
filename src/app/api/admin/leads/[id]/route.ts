import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

// ── GET /api/admin/leads/[id] — talep detayı ─────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true, make: true, model: true, year: true, price: true,
          sourceName: true, city: true, imageUrl: true, sourceUrl: true,
        },
      },
      notes: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ lead })
}

// ── PATCH /api/admin/leads/[id] — durum güncelleme ───────────────────────
//
// Body: { status?: string, name?: string, phone?: string, email?: string, message?: string }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { status, name, phone, email, message } = body

  const data: Record<string, unknown> = {}
  if (status) data.status = String(status)
  if (name !== undefined) data.name = String(name)
  if (phone !== undefined) data.phone = String(phone)
  if (email !== undefined) data.email = email ? String(email) : null
  if (message !== undefined) data.message = message ? String(message) : null

  const updated = await db.lead.update({ where: { id }, data })
  return NextResponse.json({ lead: updated })
}
