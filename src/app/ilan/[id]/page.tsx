import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { loadFallbackListings } from '@/lib/services/fallback-data'
import { transformListing } from '@/lib/utils/transform-listing'
import type { Metadata } from 'next'

// ── Generate static metadata for SEO ────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  let listing: any = null
  try {
    listing = await db.listing.findUnique({ where: { id } })
  } catch {
    const fallback = loadFallbackListings().find((l) => l.id === id)
    if (fallback) listing = fallback
  }

  if (!listing) {
    return { title: 'İlan bulunamadı — Otodedektif' }
  }

  const title = `${listing.make} ${listing.model} ${listing.year} — ${listing.price?.toLocaleString('tr-TR')} TL | Otodedektif`
  const description = `${listing.year} ${listing.make} ${listing.model}${listing.fuelType ? `, ${listing.fuelType}` : ''}${listing.mileageKm ? `, ${listing.mileageKm.toLocaleString('tr-TR')} km` : ''} — ${listing.price?.toLocaleString('tr-TR')} TL. ${listing.city ? listing.city : ''} konumunda ikinci el araç ilanı.`

  return {
    title,
    description,
    keywords: [listing.make, listing.model, String(listing.year), 'ikinci el', 'otomobil', listing.fuelType, listing.city].filter(Boolean) as string[],
    openGraph: {
      title,
      description,
      type: 'website',
      images: listing.imageUrl ? [listing.imageUrl] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: listing.imageUrl ? [listing.imageUrl] : [],
    },
  }
}

// ── Server Component — SEO-friendly ilan detay sayfası ──────────────────

export default async function IlanDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let listing: any = null
  let priceHistory: any[] = []
  let comparables: any[] = []

  try {
    listing = await db.listing.findUnique({
      where: { id },
      include: {
        priceHistory: { orderBy: { recordedAt: 'desc' }, take: 20 },
      },
    })

    if (listing) {
      comparables = await db.listing.findMany({
        where: {
          make: { equals: listing.make },
          model: { equals: listing.model },
          year: { gte: listing.year - 2, lte: listing.year + 2 },
          isActive: true,
          isDeleted: false,
          id: { not: id },
        },
        orderBy: { dealScore: 'asc' },
        take: 8,
      })
    }
  } catch (err) {
    const fallback = loadFallbackListings().find((l) => l.id === id)
    if (fallback) {
      listing = fallback
      comparables = loadFallbackListings()
        .filter((l) => l.id !== id && l.make === fallback.make && l.model === fallback.model)
        .slice(0, 8)
    }
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">İlan bulunamadı</h1>
          <p className="text-muted-foreground mb-4">Bu ilan artık mevcut değil.</p>
          <a href="/" className="text-orange-600 hover:underline">← Ana sayfaya dön</a>
        </div>
      </div>
    )
  }

  const turkishFormatter = new Intl.NumberFormat('tr-TR')
  const formatPrice = (p: number) => `${turkishFormatter.format(Math.round(p))} TL`

  // JSON-LD structured data for Google
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `${listing.make} ${listing.model} ${listing.year}`,
    brand: { '@type': 'Brand', name: listing.make },
    model: listing.model,
    vehicleModelDate: String(listing.year),
    fuelType: listing.fuelType,
    vehicleTransmission: listing.transmission,
    mileageFromOdometer: listing.mileageKm ? {
      '@type': 'QuantitativeValue',
      value: listing.mileageKm,
      unitCode: 'KMT',
    } : undefined,
    color: listing.color,
    offers: {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: 'TRY',
      availability: 'https://schema.org/InStock',
      url: listing.sourceUrl,
    },
    image: listing.imageUrl,
    url: listing.sourceUrl,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto p-4 pt-6">
        {/* Back link */}
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          ← Tüm ilanlar
        </a>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-1">
          {listing.make} {listing.model}
        </h1>
        <p className="text-muted-foreground mb-4">
          {listing.year}
          {listing.fuelType ? ` • ${listing.fuelType}` : ''}
          {listing.transmission ? ` • ${listing.transmission}` : ''}
          {listing.mileageKm ? ` • ${turkishFormatter.format(listing.mileageKm)} km` : ''}
        </p>

        {/* Image */}
        {listing.imageUrl && (
          <div className="rounded-xl overflow-hidden mb-4 border">
            <img
              src={listing.imageUrl}
              alt={`${listing.make} ${listing.model} ${listing.year}`}
              className="w-full h-64 sm:h-96 object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </div>
        )}

        {/* Price + Deal */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <p className="text-3xl font-extrabold text-orange-700">{formatPrice(listing.price)}</p>
            {listing.estimatedValue && (
              <p className="text-sm text-muted-foreground">
                Tahmini değer: {formatPrice(listing.estimatedValue)}
              </p>
            )}
          </div>
          {listing.dealTag && (
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-700">
              {listing.dealTag}
            </span>
          )}
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {listing.fuelType && <SpecCard label="Yakıt" value={listing.fuelType} />}
          {listing.transmission && <SpecCard label="Vites" value={listing.transmission} />}
          {listing.mileageKm != null && <SpecCard label="Kilometre" value={`${turkishFormatter.format(listing.mileageKm)} km`} />}
          {listing.color && <SpecCard label="Renk" value={listing.color} />}
          {listing.city && <SpecCard label="Şehir" value={listing.city} />}
          {listing.sellerType && <SpecCard label="Satıcı" value={listing.sellerType} />}
        </div>

        {/* Description */}
        {listing.description && (
          <div className="mb-6">
            <h2 className="font-semibold mb-2">Açıklama</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {listing.description}
            </p>
          </div>
        )}

        {/* Source link */}
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700 transition-colors"
        >
          İlanı kaynağında gör →
        </a>

        {/* Comparables */}
        {comparables.length > 0 && (
          <div className="mt-8">
            <h2 className="font-semibold mb-3">Benzer İlanlar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {comparables.map((c: any) => (
                <a
                  key={c.id}
                  href={`/ilan/${c.id}`}
                  className="flex gap-3 p-3 rounded-lg border hover:shadow-md transition-shadow"
                >
                  {c.imageUrl && (
                    <img
                      src={c.imageUrl}
                      alt={`${c.make} ${c.model}`}
                      className="w-20 h-20 rounded-lg object-cover shrink-0"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.make} {c.model}</p>
                    <p className="text-xs text-muted-foreground">{c.year}</p>
                    <p className="text-sm font-bold text-orange-700">{formatPrice(c.price)}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm capitalize">{value}</p>
    </div>
  )
}
