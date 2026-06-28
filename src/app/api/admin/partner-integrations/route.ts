import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'
import { ADAPTER_STATUSES } from '@/lib/adapters'

// ── GET /api/admin/partner-integrations ───────────────────────────────────
//
// PartnerNegotiation tablosunu ADAPTER_STATUSES ile join'ler.

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const negotiations = await db.partnerNegotiation.findMany({
    orderBy: { updatedAt: 'desc' },
  })

  // Her adaptör için karşılık gelen görüşme kaydını eşle
  const partners = ADAPTER_STATUSES.map((adapter) => {
    const negotiation = negotiations.find((n) => n.adapterKey === adapter.name)
    return {
      adapterKey: adapter.name,
      companyName: negotiation?.companyName || adapter.displayName,
      adapterStatus: adapter.status,
      adapterNote: adapter.note,
      deepLinkBaseUrl: adapter.deepLinkBaseUrl,
      negotiation: negotiation || null,
    }
  })

  // Ayrıca ADAPTER_STATUSES'te olmayan ama PartnerNegotiation'da kayıtlı firmalar
  const orphans = negotiations.filter(
    (n) => !ADAPTER_STATUSES.some((a) => a.name === n.adapterKey),
  )

  return NextResponse.json({ partners, orphans, allNegotiations: negotiations })
}

// ── POST — yeni görüşme / güncelleme ──────────────────────────────────────
//
// Body: { id?: string, companyName, adapterKey?, status?, contactName?,
//        contactInfo?, notes?, lastContactDate? }
// - id verilirse: güncelleme
// - id yoksa: yeni kayıt (companyName + adapterKey ile)

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, companyName, adapterKey, status, contactName, contactInfo, notes, lastContactDate } = body

  if (id) {
    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = String(status)
    if (contactName !== undefined) data.contactName = contactName ? String(contactName) : null
    if (contactInfo !== undefined) data.contactInfo = contactInfo ? String(contactInfo) : null
    if (notes !== undefined) data.notes = notes ? String(notes) : null
    if (lastContactDate !== undefined) data.lastContactDate = lastContactDate ? new Date(lastContactDate) : null
    if (companyName !== undefined) data.companyName = String(companyName)
    if (adapterKey !== undefined) data.adapterKey = adapterKey ? String(adapterKey) : null

    const updated = await db.partnerNegotiation.update({ where: { id }, data })
    return NextResponse.json({ negotiation: updated })
  }

  if (!companyName) {
    return NextResponse.json({ error: 'companyName required' }, { status: 400 })
  }

  const negotiation = await db.partnerNegotiation.create({
    data: {
      companyName: String(companyName),
      adapterKey: adapterKey ? String(adapterKey) : null,
      status: status || 'not_started',
      contactName: contactName ? String(contactName) : null,
      contactInfo: contactInfo ? String(contactInfo) : null,
      notes: notes ? String(notes) : null,
      lastContactDate: lastContactDate ? new Date(lastContactDate) : null,
    },
  })
  return NextResponse.json({ negotiation }, { status: 201 })
}

export async function PATCH(request: Request) {
  return POST(request)
}
