import { db } from '@/lib/db'
import SalesPipelineClient from './sales-pipeline-client'

export default async function SalesPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; city?: string }>
}) {
  const params = await searchParams
  const status = params.status || 'all'
  const city = params.city || 'all'

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.status = status
  if (city !== 'all') where.city = city

  const [visits, dealers] = await Promise.all([
    db.salesVisit.findMany({
      where,
      include: {
        dealer: { select: { id: true, name: true, city: true, subscriptionPlan: true } },
      },
      orderBy: { visitDate: 'desc' },
      take: 200,
    }),
    db.dealer.findMany({
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Tüm şehirler (ziyaretlerden + dealerlardan)
  const citySet = new Set<string>()
  visits.forEach((v) => citySet.add(v.city))
  dealers.forEach((d) => citySet.add(d.city))
  const cities = Array.from(citySet).sort()

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Saha Satış Takibi</h1>
        <p className="text-sm text-muted-foreground">
          Galeri ziyaretleri ve görüşme durumları.
        </p>
      </header>

      <SalesPipelineClient
        initialVisits={visits.map((v) => ({
          ...v,
          visitDate: v.visitDate.toISOString(),
          dealerName: v.dealer?.name || null,
        }))}
        dealers={dealers}
        cities={cities}
        filters={{ status, city }}
      />
    </div>
  )
}
