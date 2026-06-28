import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

// ── GET /api/admin/listings/[id] — ilan detayı ───────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      variant: { include: { series: { include: { brand: true } } } },
      dealer: { select: { id: true, name: true, city: true } },
    },
  })
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ listing })
}

// ── PATCH /api/admin/listings/[id] — manuel güncelleme ───────────────────
//
// Body: { price?, make?, model?, isActive?, isDeleted?, variantId?,
//        dealerId?, matchStatus? }
// - variantId "" (boş string) verilirse null yap (eşleşmeyi sıfırla)
// - dealerId "" verilirse null yap

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { price, make, model, isActive, isDeleted, variantId, dealerId, matchStatus } = body

  const data: Record<string, unknown> = {}
  if (price !== undefined) data.price = Number(price)
  if (make !== undefined) data.make = String(make)
  if (model !== undefined) data.model = String(model)
  if (isActive !== undefined) data.isActive = Boolean(isActive)
  if (isDeleted !== undefined) data.isDeleted = Boolean(isDeleted)
  if (variantId !== undefined) {
    data.variantId = variantId === '' ? null : String(variantId)
    // Manuel eşleştirme yapıldığında matchStatus'u "matched" yap
    if (variantId) {
      data.matchStatus = 'matched'
      data.matchConfidence = 1.0
    }
  }
  if (dealerId !== undefined) data.dealerId = dealerId === '' ? null : String(dealerId)
  if (matchStatus !== undefined) data.matchStatus = String(matchStatus)

  const updated = await db.listing.update({ where: { id }, data })
  return NextResponse.json({ listing: updated })
}
