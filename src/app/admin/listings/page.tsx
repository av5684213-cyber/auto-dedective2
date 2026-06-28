import { db } from '@/lib/db'
import Link from 'next/link'
import ListingsManager from './listings-manager'

// ── Admin: İlan Yönetimi ──────────────────────────────────────────────────

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; matchStatus?: string; q?: string }>
}) {
  const params = await searchParams
  const source = params.source || 'all'
  const matchStatus = params.matchStatus || 'all'
  const q = params.q || ''

  const where: Record<string, unknown> = {}
  if (source !== 'all') where.sourceName = source
  if (matchStatus !== 'all') where.matchStatus = matchStatus
  if (q) {
    where.OR = [
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [listings, sources, catalog] = await Promise.all([
    db.listing.findMany({
      where,
      select: {
        id: true, sourceName: true, make: true, model: true, year: true,
        price: true, city: true, isActive: true, isDeleted: true,
        matchStatus: true, matchConfidence: true, variantId: true, dealerId: true,
        variant: { select: { id: true, name: true, series: { select: { name: true, brand: { select: { name: true } } } } } },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    }),
    db.listing.findMany({
      select: { sourceName: true },
      distinct: ['sourceName'],
    }),
    db.vehicleBrand.findMany({
      include: {
        series: {
          include: {
            variants: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">İlan Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          İlanları düzenle, eşleştir, görünürlüğünü kontrol et.
        </p>
      </header>

      <ListingsManager
        initialListings={listings.map((l) => ({
          ...l,
          variantName: l.variant
            ? `${l.variant.series.brand.name} ${l.variant.series.name} ${l.variant.name}`
            : null,
        }))}
        sources={sources.map((s) => s.sourceName)}
        catalog={catalog.map((b) => ({
          id: b.id,
          name: b.name,
          series: b.series.map((s) => ({
            id: s.id,
            name: s.name,
            variants: s.variants,
          })),
        }))}
        filters={{ source, matchStatus, q }}
      />
    </div>
  )
}
