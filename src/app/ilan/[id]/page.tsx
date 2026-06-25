import { db } from '@/lib/db'
import { loadFallbackListings } from '@/lib/services/fallback-data'
import { transformListing } from '@/lib/utils/transform-listing'
import type { Metadata } from 'next'
import { ListingDetailContent } from '@/components/listing-detail-content'
import type { ListingWithScore } from '@/lib/types'

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

  try {
    listing = await db.listing.findUnique({
      where: { id },
      include: {
        priceHistory: { orderBy: { recordedAt: 'desc' }, take: 20 },
      },
    })
  } catch (err) {
    // DB hatası — fallback'e düş
  }

  // DB'de bulunamadıysa fallback data'ya bak
  if (!listing) {
    const fallback = loadFallbackListings().find((l) => l.id === id)
    if (fallback) listing = fallback
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

  // Listing'i ListingWithScore formatına dönüştür (fallback data zaten uyumlu,
  // ama DB'den gelen kayıtlar transformListing'den geçmeli)
  const initialListing: ListingWithScore = listing.id && listing.imageUrls
    ? listing as ListingWithScore
    : transformListing(listing as unknown as Record<string, unknown>)

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

      {/* Listing detail content (client component) */}
      <ListingDetailContent
        initialListing={initialListing}
        listingId={id}
      />
    </div>
  )
}
