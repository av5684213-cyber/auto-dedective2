import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser } from '@/lib/admin-auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const dealer = await db.dealer.findUnique({
    where: { id },
    include: {
      listings: {
        select: { id: true, make: true, model: true, year: true, price: true, isActive: true },
        take: 50,
        orderBy: { lastSeenAt: 'desc' },
      },
      salesVisits: { orderBy: { visitDate: 'desc' }, take: 10 },
    },
  })
  if (!dealer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ dealer })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { name, city, phone, email, subscriptionPlan, subscriptionPrice,
          subscriptionStatus, lastPaymentDate, nextPaymentDue } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = String(name)
  if (city !== undefined) data.city = String(city)
  if (phone !== undefined) data.phone = String(phone)
  if (email !== undefined) data.email = email ? String(email) : null
  if (subscriptionPlan !== undefined) data.subscriptionPlan = String(subscriptionPlan)
  if (subscriptionPrice !== undefined) data.subscriptionPrice = subscriptionPrice ? Number(subscriptionPrice) : null
  if (subscriptionStatus !== undefined) data.subscriptionStatus = String(subscriptionStatus)
  if (lastPaymentDate !== undefined) data.lastPaymentDate = lastPaymentDate ? new Date(lastPaymentDate) : null
  if (nextPaymentDue !== undefined) data.nextPaymentDue = nextPaymentDue ? new Date(nextPaymentDue) : null

  const updated = await db.dealer.update({ where: { id }, data })
  return NextResponse.json({ dealer: updated })
}
