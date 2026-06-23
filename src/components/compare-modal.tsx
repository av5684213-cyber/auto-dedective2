'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Fuel, Gauge, MapPin, Settings2, Car, ExternalLink, TrendingDown,
  TrendingUp, Minus, ArrowRight, BarChart3, Calendar, Coins,
} from 'lucide-react'
import { DealBadge } from '@/components/deal-badge'
import { formatPrice } from '@/components/price-display'
import { SOURCE_PLATFORMS } from '@/lib/constants'
import type { ListingWithScore } from '@/lib/types'

interface CompareModalProps {
  open: boolean
  onClose: () => void
  ids: [string, string] | null
}

interface MarketStats {
  avgPrice: number
  medianPrice: number
  minPrice: number
  maxPrice: number
  count: number
  make: string
  model: string
  yearRange: { min: number; max: number }
  avgMileage: number | null
  avgYear: number | null
}

interface ComparisonData {
  listings: ListingWithScore[]
  marketStats: MarketStats
  comparison: {
    priceDifference: number
    priceDifferencePercent: number
    cheaperListingIndex: 0 | 1
    mileageDifference: number
    yearDifference: number
    marketComparison: Array<{
      listingIndex: 0 | 1
      priceVsMarket: number
      mileageVsMarket: number | null
      yearVsMarket: number | null
      verdict: string
    }>
  }
}

const turkishFormatter = new Intl.NumberFormat('tr-TR')

function getSourcePlatform(sourceName: string) {
  return SOURCE_PLATFORMS.find((s) => s.name === sourceName) || {
    name: sourceName, displayName: sourceName, baseUrl: '#',
    color: '#6b7280', icon: '🔗',
  }
}

// ── Comparison Row Component ────────────────────────────────────────────
//
// Renders one spec for both listings side by side, with the better value
// highlighted in green.

function ComparisonRow({
  icon: Icon,
  label,
  value1,
  value2,
  formatValue,
  betterIsLower = false,
  suffix = '',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value1: number | null | undefined
  value2: number | null | undefined
  formatValue: (v: number) => string
  betterIsLower?: boolean
  suffix?: string
}) {
  const v1 = value1 ?? null
  const v2 = value2 ?? null

  let winner: 0 | 1 | null = null
  if (v1 !== null && v2 !== null && v1 !== v2) {
    if (betterIsLower) {
      winner = v1 < v2 ? 0 : 1
    } else {
      winner = v1 > v2 ? 0 : 1
    }
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center py-2.5 border-b border-border/50 last:border-0">
      {/* Listing 1 value */}
      <div className={`text-right pr-2 ${winner === 0 ? 'text-green-600 font-semibold' : 'text-foreground'}`}>
        {v1 !== null ? `${formatValue(v1)}${suffix}` : '—'}
      </div>

      {/* Label with icon */}
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs whitespace-nowrap">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>

      {/* Listing 2 value */}
      <div className={`text-left pl-2 ${winner === 1 ? 'text-green-600 font-semibold' : 'text-foreground'}`}>
        {v2 !== null ? `${formatValue(v2)}${suffix}` : '—'}
      </div>
    </div>
  )
}

// ── Market Comparison Card ──────────────────────────────────────────────

function MarketCard({
  listing,
  marketComparison,
  marketStats,
  index,
}: {
  listing: ListingWithScore
  marketComparison: ComparisonData['comparison']['marketComparison'][0]
  marketStats: MarketStats
  index: 0 | 1
}) {
  const source = getSourcePlatform(listing.sourceName)
  const priceVsMarket = marketComparison.priceVsMarket
  const mileageVsMarket = marketComparison.mileageVsMarket
  const yearVsMarket = marketComparison.yearVsMarket

  const isCheaper = priceVsMarket < -5
  const isExpensive = priceVsMarket > 5

  return (
    <div className="flex flex-col gap-3">
      {/* Listing header */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {listing.make} {listing.model}
            </h3>
            <p className="text-xs text-muted-foreground">{listing.year}</p>
          </div>
          <Badge
            className="text-[10px] h-5 border-0 shrink-0"
            style={{ backgroundColor: source.color, color: '#fff' }}
          >
            {source.icon} {source.displayName}
          </Badge>
        </div>

        {/* Price */}
        <div className="text-xl font-bold text-teal-700">
          {formatPrice(listing.price)}
        </div>

        {/* Deal tag */}
        {listing.dealTag && (
          <div className="mt-1">
            <DealBadge tag={listing.dealTag} />
          </div>
        )}
      </div>

      {/* Image */}
      {listing.imageUrl && (
        <div className="rounded-lg overflow-hidden border h-32 bg-muted">
          <img
            src={listing.imageUrl}
            alt={`${listing.make} ${listing.model}`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Market comparison */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <BarChart3 className="h-3.5 w-3.5" />
          Piysa Karşılaştırması
        </div>

        {/* Price vs market */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Coins className="h-3.5 w-3.5" /> Fiyat
          </span>
          <span className={`flex items-center gap-1 font-medium ${
            isCheaper ? 'text-green-600' : isExpensive ? 'text-red-600' : 'text-amber-600'
          }`}>
            {priceVsMarket > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {priceVsMarket > 0 ? '+' : ''}{priceVsMarket.toFixed(0)}%
          </span>
        </div>

        {/* Mileage vs market */}
        {mileageVsMarket !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" /> KM
            </span>
            <span className={`flex items-center gap-1 font-medium ${
              mileageVsMarket < -10 ? 'text-green-600' : mileageVsMarket > 10 ? 'text-amber-600' : 'text-foreground'
            }`}>
              {mileageVsMarket > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {mileageVsMarket > 0 ? '+' : ''}{mileageVsMarket.toFixed(0)}%
            </span>
          </div>
        )}

        {/* Year vs market */}
        {yearVsMarket !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Yıl
            </span>
            <span className={`flex items-center gap-1 font-medium ${
              yearVsMarket > 0 ? 'text-green-600' : yearVsMarket < 0 ? 'text-amber-600' : 'text-foreground'
            }`}>
              {yearVsMarket > 0 ? '+' : ''}{yearVsMarket} yıl
            </span>
          </div>
        )}

        <Separator className="my-1" />

        {/* Verdict */}
        <p className="text-xs text-muted-foreground italic">
          {marketComparison.verdict}
        </p>

        {/* External link */}
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-1"
        >
          <ExternalLink className="h-3 w-3" />
          Kaynakta gör
        </a>
      </div>
    </div>
  )
}

// ── Main Compare Modal ──────────────────────────────────────────────────

export function CompareModal({ open, onClose, ids }: CompareModalProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !ids) {
      setData(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    fetch('/api/favorites/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((d: ComparisonData) => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Karşılaştırma başarısız')
        setLoading(false)
      })
  }, [open, ids])

  const comparison = data?.comparison
  const marketStats = data?.marketStats
  const listings = data?.listings

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5 text-teal-600" />
            İlan Karşılaştırma
          </DialogTitle>
          <DialogDescription>
            İki ilanı yan yana karşılaştırın ve piyasa ortalaması ile fark görün
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)] px-6 pb-6">
          {loading && (
            <div className="py-12 text-center text-muted-foreground">
              <div className="animate-pulse">Karşılaştırma yapılıyor...</div>
            </div>
          )}

          {error && (
            <div className="py-12 text-center">
              <p className="text-red-600 mb-2">{error}</p>
              <Button variant="outline" onClick={onClose}>Kapat</Button>
            </div>
          )}

          {data && listings && comparison && marketStats && !loading && !error && (
            <div className="space-y-4">
              {/* ── Two-column listing comparison ── */}
              <div className="grid grid-cols-2 gap-4">
                <MarketCard
                  listing={listings[0]}
                  marketComparison={comparison.marketComparison[0]}
                  marketStats={marketStats}
                  index={0}
                />
                <MarketCard
                  listing={listings[1]}
                  marketComparison={comparison.marketComparison[1]}
                  marketStats={marketStats}
                  index={1}
                />
              </div>

              {/* ── Head-to-head spec comparison ── */}
              <div className="rounded-lg border bg-card p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-teal-600" />
                  Özellik Karşılaştırması
                </h4>

                <ComparisonRow
                  icon={Coins}
                  label="Fiyat"
                  value1={listings[0].price}
                  value2={listings[1].price}
                  formatValue={(v) => formatPrice(v)}
                  betterIsLower
                />

                <ComparisonRow
                  icon={Gauge}
                  label="Kilometre"
                  value1={listings[0].mileageKm}
                  value2={listings[1].mileageKm}
                  formatValue={(v) => turkishFormatter.format(v)}
                  betterIsLower
                  suffix=" km"
                />

                <ComparisonRow
                  icon={Calendar}
                  label="Yıl"
                  value1={listings[0].year}
                  value2={listings[1].year}
                  formatValue={(v) => String(v)}
                />

                <ComparisonRow
                  icon={Fuel}
                  label="Yakıt"
                  value1={null}
                  value2={null}
                  formatValue={() => ''}
                />
                {/* Fuel (string, not number — special handling) */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center py-2.5 border-b border-border/50">
                  <div className="text-right pr-2 text-foreground">
                    {listings[0].fuelType || '—'}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs whitespace-nowrap">
                    <Fuel className="h-3.5 w-3.5" />
                    <span>Yakıt</span>
                  </div>
                  <div className="text-left pl-2 text-foreground">
                    {listings[1].fuelType || '—'}
                  </div>
                </div>

                {/* Transmission */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center py-2.5 border-b border-border/50">
                  <div className="text-right pr-2 text-foreground">
                    {listings[0].transmission || '—'}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs whitespace-nowrap">
                    <Settings2 className="h-3.5 w-3.5" />
                    <span>Vites</span>
                  </div>
                  <div className="text-left pl-2 text-foreground">
                    {listings[1].transmission || '—'}
                  </div>
                </div>

                {/* City */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center py-2.5">
                  <div className="text-right pr-2 text-foreground">
                    {listings[0].city || '—'}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs whitespace-nowrap">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Şehir</span>
                  </div>
                  <div className="text-left pl-2 text-foreground">
                    {listings[1].city || '—'}
                  </div>
                </div>
              </div>

              {/* ── Pairwise differences ── */}
              <div className="rounded-lg border bg-teal-50/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <ArrowRight className="h-4 w-4 text-teal-600" />
                  İkili Farklar
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Price difference */}
                  <div className="rounded-lg bg-white p-3 border">
                    <div className="text-xs text-muted-foreground mb-1">Fiyat Farkı</div>
                    <div className={`text-lg font-bold ${
                      comparison.priceDifference < 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {comparison.priceDifference > 0 ? '+' : ''}{formatPrice(Math.abs(comparison.priceDifference))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ({comparison.priceDifferencePercent > 0 ? '+' : ''}
                      {comparison.priceDifferencePercent.toFixed(1)}%)
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {comparison.cheaperListingIndex === 0 ? '1. ilan daha ucuz' : '2. ilan daha ucuz'}
                    </div>
                  </div>

                  {/* Mileage difference */}
                  <div className="rounded-lg bg-white p-3 border">
                    <div className="text-xs text-muted-foreground mb-1">KM Farkı</div>
                    <div className={`text-lg font-bold ${
                      comparison.mileageDifference < 0 ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {comparison.mileageDifference > 0 ? '+' : ''}
                      {turkishFormatter.format(Math.abs(comparison.mileageDifference))} km
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {comparison.mileageDifference < 0 ? '1. ilan daha az km' : '2. ilan daha az km'}
                    </div>
                  </div>

                  {/* Year difference */}
                  <div className="rounded-lg bg-white p-3 border">
                    <div className="text-xs text-muted-foreground mb-1">Yıl Farkı</div>
                    <div className={`text-lg font-bold ${
                      comparison.yearDifference > 0 ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {comparison.yearDifference > 0 ? '+' : ''}{comparison.yearDifference} yıl
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {comparison.yearDifference > 0 ? '2. ilan daha yeni' : '1. ilan daha yeni'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Market stats ── */}
              {marketStats.count > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-teal-600" />
                    Piyasa İstatistikleri — {marketStats.make} {marketStats.model}
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Ortalama Fiyat</div>
                      <div className="font-semibold">{formatPrice(marketStats.avgPrice)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Medyan Fiyat</div>
                      <div className="font-semibold">{formatPrice(marketStats.medianPrice)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Fiyat Aralığı</div>
                      <div className="font-semibold text-xs">
                        {formatPrice(marketStats.minPrice)} - {formatPrice(marketStats.maxPrice)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">İlan Sayısı</div>
                      <div className="font-semibold">{marketStats.count}</div>
                    </div>
                  </div>

                  {marketStats.avgMileage && (
                    <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                      Ortalama KM: <span className="font-medium text-foreground">
                        {turkishFormatter.format(marketStats.avgMileage)} km
                      </span>
                      {marketStats.avgYear && (
                        <>
                          {' '} • Ortalama Yıl: <span className="font-medium text-foreground">{marketStats.avgYear}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
