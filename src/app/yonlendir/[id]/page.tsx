// Otodedektif - Yönlendirme Sayfası (Server Component)
//
// /yonlendir/[id] → listing bulunur, kaynak URL client component'e pass edilir
//
// AutoUncle tarzı: "You are now leaving AutoUncle → Forwarding you to {site}"
// Otodedektif tarzı: "Otodedektif'ten ayrılıyorsunuz → Sizi {kaynak} sitesine yönlendiriyoruz"

import { db } from '@/lib/db'
import { loadFallbackListings } from '@/lib/services/fallback-data'
import type { Metadata } from 'next'
import { RedirectScreen } from './redirect-screen'

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
    return { title: 'Yönlendirme — Otodedektif', robots: { index: false, follow: false } }
  }

  return {
    title: `${listing.sourceName} sitesine yönlendiriliyorsunuz — Otodedektif`,
    description: `${listing.make} ${listing.model} ${listing.year} ilanı için ${listing.sourceName} sitesine yönlendiriliyorsunuz.`,
    robots: { index: false, follow: false },
  }
}

export default async function YonlendirPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let listing: any = null
  try {
    listing = await db.listing.findUnique({ where: { id } })
  } catch {
    const fallback = loadFallbackListings().find((l) => l.id === id)
    if (fallback) listing = fallback
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-6">
          <h1 className="text-2xl font-bold mb-2">İlan bulunamadı</h1>
          <p className="text-muted-foreground mb-4">Yönlendirme yapılamadı.</p>
          <a href="/" className="text-orange-600 hover:underline">← Ana sayfaya dön</a>
        </div>
      </div>
    )
  }

  // Source domain'i çıkar (https://www.otosor.com.tr/ilan/... → www.otosor.com.tr)
  let sourceDomain = listing.sourceName
  try {
    const url = new URL(listing.sourceUrl)
    sourceDomain = url.hostname
  } catch {
    // URL parse edilemezse sourceName kullan
  }

  return (
    <RedirectScreen
      listingId={id}
      sourceUrl={listing.sourceUrl}
      sourceName={listing.sourceName}
      sourceDomain={sourceDomain}
      make={listing.make}
      model={listing.model}
      year={listing.year}
    />
  )
}
