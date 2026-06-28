import { db } from '@/lib/db'
import DealersManager from './dealers-manager'

export default async function DealersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; plan?: string; overdue?: string }>
}) {
  const params = await searchParams
  const overdue = params.overdue === '1'

  const where: Record<string, unknown> = {}
  if (params.status && params.status !== 'all') where.subscriptionStatus = params.status
  if (params.plan && params.plan !== 'all') where.subscriptionPlan = params.plan
  if (overdue) {
    where.subscriptionStatus = 'active'
    where.nextPaymentDue = { lt: new Date() }
  }

  const dealers = await db.dealer.findMany({
    where,
    include: { _count: { select: { listings: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Aktif ilan sayısı
  const dealersWithActive = await Promise.all(
    dealers.map(async (d) => {
      const activeListings = await db.listing.count({
        where: { dealerId: d.id, isActive: true, isDeleted: false },
      })
      return {
        ...d,
        activeListingCount: activeListings,
        totalListingCount: d._count.listings,
      }
    }),
  )

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Esnaf/Galeri Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Galeri müşterileri ve abonelik durumları.
        </p>
      </header>

      <DealersManager initialDealers={dealersWithActive} />
    </div>
  )
}
