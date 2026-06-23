'use client'

import { useEffect, useReducer, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Fuel, Gauge, MapPin, Settings2, Car,
  ExternalLink, TrendingDown, Shield, Wrench, Receipt, Droplets,
  Clock, Heart, Share2, Check
} from 'lucide-react'
import { DealBadge } from '@/components/deal-badge'
import { PriceDisplay, formatPrice } from '@/components/price-display'
import { StarRating } from '@/components/star-rating'
import { ShareButton } from '@/components/share-button'
import { useFavorites } from '@/hooks/use-favorites'
import { SOURCE_PLATFORMS, DEAL_TAG_CONFIG } from '@/lib/constants'
import type { ListingWithScore } from '@/lib/types'

interface ListingDetailProps {
  listing: ListingWithScore | null
  open: boolean
  onClose: () => void
  onComparableClick: (listing: ListingWithScore) => void
}

interface ListingDetailData {
  listing: ListingWithScore
  priceHistory: { id: string; price: number; recordedAt: string }[]
  comparables: ListingWithScore[]
}

const turkishFormatter = new Intl.NumberFormat('tr-TR')

function getSourcePlatform(sourceName: string) {
  return SOURCE_PLATFORMS.find(s => s.name === sourceName) || {
    name: sourceName,
    displayName: sourceName,
    baseUrl: '#',
    color: '#6b7280',
    icon: '🔗',
  }
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function CostBar({ label, amount, maxAmount, icon, color }: {
  label: string
  amount: number
  maxAmount: number
  icon: React.ReactNode
  color: string
}) {
  const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-muted-foreground">{label}</span>
        </div>
        <span className="font-medium">{formatPrice(amount)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  )
}

interface DetailState {
  data: ListingDetailData | null
  loading: boolean
  currentId: string | null
  imgError: boolean
}

function detailReducer(state: DetailState, action: { type: string; payload?: unknown }): DetailState {
  switch (action.type) {
    case 'FETCH_START':
      return { data: null, loading: true, currentId: action.payload as string, imgError: false }
    case 'FETCH_SUCCESS':
      return { ...state, data: action.payload as ListingDetailData, loading: false }
    case 'FETCH_ERROR':
      return { ...state, loading: false }
    case 'IMG_ERROR':
      return { ...state, imgError: true }
    default:
      return state
  }
}

export function ListingDetail({ listing, open, onClose, onComparableClick }: ListingDetailProps) {
  const [state, dispatch] = useReducer(detailReducer, {
    data: null,
    loading: false,
    currentId: null,
    imgError: false,
  })

  useEffect(() => {
    if (!listing || !open) return
    let cancelled = false
    const id = listing.id

    dispatch({ type: 'FETCH_START', payload: id })
    fetch(`/api/listings/${id}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', payload: data })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'FETCH_ERROR' })
      })

    return () => { cancelled = true }
  }, [listing, open])

  if (!listing) return null

  const source = getSourcePlatform(listing.sourceName)
  const detail = state.data?.listing || listing
  const detailHasImage = detail.imageUrl && !state.imgError
  const costItems: { label: string; amount: number; icon: React.ReactNode; color: string }[] = []

  if (detail.annualDepreciationAmount) {
    costItems.push({
      label: 'Yıllık Depresyasyon',
      amount: detail.annualDepreciationAmount,
      icon: <TrendingDown className="h-4 w-4 text-red-500" />,
      color: 'bg-red-400',
    })
  }
  if (detail.fuelCostAnnual) {
    costItems.push({
      label: 'Yakıt Maliyeti',
      amount: detail.fuelCostAnnual,
      icon: <Droplets className="h-4 w-4 text-amber-500" />,
      color: 'bg-amber-400',
    })
  }
  if (detail.insuranceCostAnnual) {
    costItems.push({
      label: 'Sigorta',
      amount: detail.insuranceCostAnnual,
      icon: <Shield className="h-4 w-4 text-blue-500" />,
      color: 'bg-blue-400',
    })
  }
  if (detail.maintenanceCostAnnual) {
    costItems.push({
      label: 'Bakım',
      amount: detail.maintenanceCostAnnual,
      icon: <Wrench className="h-4 w-4 text-orange-500" />,
      color: 'bg-orange-400',
    })
  }
  if (detail.taxCostAnnual) {
    costItems.push({
      label: 'Vergi (MTV)',
      amount: detail.taxCostAnnual,
      icon: <Receipt className="h-4 w-4 text-purple-500" />,
      color: 'bg-purple-400',
    })
  }

  const maxCost = Math.max(...costItems.map(c => c.amount), 1)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {listing.make} {listing.model} {listing.year}
          </DialogTitle>
          <DialogDescription>
            {listing.make} {listing.model} {listing.year} ilan detayları, fırsat analizi ve sahip olma maliyeti
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[90vh]">
          <div className="p-0">
            {/* Image */}
            <div className={`relative h-48 sm:h-64 ${detailHasImage ? '' : 'bg-gradient-to-br from-orange-800 to-slate-700'} flex items-center justify-center overflow-hidden`}>
              {detailHasImage ? (
                <img
                  src={detail.imageUrl!}
                  alt={`${detail.make} ${detail.model}`}
                  className="w-full h-full object-cover"
                  onError={() => dispatch({ type: 'IMG_ERROR' })}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <Car className="h-24 w-24 text-white/15" />
              )}

              {/* Source + Deal Badges */}
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge
                  className="border-0 font-medium text-xs"
                  style={{ backgroundColor: source.color, color: '#ffffff' }}
                >
                  {source.icon} {source.displayName}
                </Badge>
                <DealBadge tag={detail.dealTag} />
              </div>

              {detail.sellerType && (
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-white/90 text-gray-700 text-xs">
                    {detail.sellerType}
                  </Badge>
                </div>
              )}
            </div>

            <div className="p-6 space-y-6">
              {/* Title + Price */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">
                    {detail.make} {detail.model}
                  </h2>
                  <p className="text-muted-foreground">
                    {detail.year}{detail.trim ? ` • ${detail.trim}` : ''}
                  </p>
                </div>
                <PriceDisplay
                  price={detail.price}
                  estimatedValue={detail.estimatedValue}
                  dealTag={detail.dealTag}
                  size="lg"
                  className="text-right"
                />
              </div>

              {/* Quick Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {detail.mileageKm !== null && detail.mileageKm !== undefined && (
                  <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
                    <Gauge className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Kilometre</p>
                      <p className="text-sm font-medium">{turkishFormatter.format(detail.mileageKm)} km</p>
                    </div>
                  </div>
                )}
                {detail.fuelType && (
                  <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
                    <Fuel className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Yakıt</p>
                      <p className="text-sm font-medium">{detail.fuelType}</p>
                    </div>
                  </div>
                )}
                {detail.transmission && (
                  <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
                    <Settings2 className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Vites</p>
                      <p className="text-sm font-medium">{detail.transmission}</p>
                    </div>
                  </div>
                )}
                {detail.city && (
                  <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
                    <MapPin className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Konum</p>
                      <p className="text-sm font-medium">{detail.city}{detail.district ? ` / ${detail.district}` : ''}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Favorite + Share + Source Link */}
              <div className="flex gap-2">
                <FavoriteToggleButton listing={detail} />
                <ShareButton
                  url={detail.sourceUrl}
                  title={`${detail.make} ${detail.model} ${detail.year} - ${formatPrice(detail.price)}`}
                  variant="button"
                  size="md"
                  className="flex-shrink-0"
                />
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.open(detail.sourceUrl, '_blank', 'noopener')}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Kaynakta Gör</span>
                  <span className="sm:hidden">Gör</span>
                </Button>
              </div>

              <Separator />

              {/* Deal Analysis */}
              {(detail.estimatedValue || detail.dealScore !== null) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      📊 Fırsat Analizi
                    </h3>
                    <StarRating
                      dealScore={detail.dealScore}
                      confidence={detail.confidence}
                      size="md"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {detail.estimatedValue && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Tahmini Değer</p>
                        <p className="text-lg font-bold">{formatPrice(detail.estimatedValue)}</p>
                        {detail.confidence && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Güven: {detail.confidence === 'high' ? 'Yüksek' : detail.confidence === 'medium' ? 'Orta' : detail.confidence === 'low' ? 'Düşük' : 'Yetersiz'}
                          </p>
                        )}
                      </div>
                    )}
                    {detail.dealScore !== null && detail.dealScore !== undefined && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Fırsat Skoru</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(0, (detail.dealScore + 1) / 2 * 100)}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className={`h-full rounded-full ${
                                detail.dealScore >= 0.6 ? 'bg-green-500' :
                                detail.dealScore >= 0.3 ? 'bg-lime-500' :
                                detail.dealScore >= 0 ? 'bg-yellow-400' :
                                detail.dealScore >= -0.3 ? 'bg-orange-400' : 'bg-red-500'
                              }`}
                            />
                          </div>
                          <span className="text-sm font-bold">{Math.round(detail.dealScore * 100)}%</span>
                        </div>
                      </div>
                    )}
                    {detail.dealTag && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Değerlendirme</p>
                        <DealBadge tag={detail.dealTag} />
                        {detail.comparableCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {detail.comparableCount} karşılaştırma
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {detail.dealTag && DEAL_TAG_CONFIG[detail.dealTag] && (
                    <p className="text-sm text-muted-foreground">
                      {detail.dealTag === 'Harika Fırsat' && 'Bu araç piyasa değerinin önemli ölçüde altında fiyatlandırılmış. Hemen değerlendirin!'}
                      {detail.dealTag === 'İyi Fiyat' && 'Bu araç piyasa değerinin altında fiyatlandırılmış. İyi bir fırsat olabilir.'}
                      {detail.dealTag === 'Piyasa Fiyatı' && 'Bu araç piyasa değerine uygun fiyatlandırılmış.'}
                      {detail.dealTag === 'Piyasa Üstü' && 'Bu araç piyasa değerinin üzerinde fiyatlandırılmış. Pazarlık yapmayı deneyebilirsiniz.'}
                      {detail.dealTag === 'Pahalı' && 'Bu araç piyasa değerinin önemli ölçüde üzerinde. Dikkatli olun.'}
                      {detail.dealTag === 'Değerlendirilemedi' && 'Bu araç için yeterli karşılaştırma verisi bulunamadı.'}
                    </p>
                  )}
                </div>
              )}

              <Separator />

              {/* Full Specs */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  📋 Özellikler
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <SpecRow label="Marka" value={detail.make} />
                  <SpecRow label="Model" value={detail.model} />
                  <SpecRow label="Yıl" value={detail.year.toString()} />
                  <SpecRow label="Kilometre" value={detail.mileageKm ? `${turkishFormatter.format(detail.mileageKm)} km` : '-'} />
                  <SpecRow label="Yakıt" value={detail.fuelType || '-'} />
                  <SpecRow label="Vites" value={detail.transmission || '-'} />
                  <SpecRow label="Kasa Tipi" value={detail.bodyType || '-'} />
                  <SpecRow label="Renk" value={detail.color || '-'} />
                  <SpecRow label="Şehir" value={detail.city || '-'} />
                  <SpecRow label="İlçe" value={detail.district || '-'} />
                  <SpecRow label="Satıcı" value={detail.sellerType || '-'} />
                  <SpecRow label="Kaynak" value={source.displayName} />
                </div>
              </div>

              <Separator />

              {/* Ownership Cost Breakdown */}
              {costItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    💰 Sahip Olma Maliyeti (Yıllık)
                  </h3>
                  {detail.ownershipCostAnnual && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                      <p className="text-sm text-amber-800">
                        Toplam yıllık sahip olma maliyeti: <span className="font-bold">{formatPrice(detail.ownershipCostAnnual)}</span>
                      </p>
                      {detail.annualDepreciationPercent && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Yıllık depresyasyon oranı: %{detail.annualDepreciationPercent.toFixed(1)}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-3">
                    {costItems.map((item) => (
                      <CostBar
                        key={item.label}
                        label={item.label}
                        amount={item.amount}
                        maxAmount={maxCost}
                        icon={item.icon}
                        color={item.color}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Price History */}
              {state.data?.priceHistory && state.data.priceHistory.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    📈 Fiyat Geçmişi
                  </h3>
                  <div className="space-y-2">
                    {state.data.priceHistory.slice(0, 10).map((ph, i) => (
                      <div key={ph.id} className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground w-32">
                          <Clock className="h-3 w-3" />
                          {formatDate(ph.recordedAt)}
                        </div>
                        <span className="font-medium">{formatPrice(ph.price)}</span>
                        {i > 0 && state.data!.priceHistory[i - 1] && (
                          <span className={`text-xs ${ph.price < state.data!.priceHistory[i - 1].price ? 'text-green-500' : ph.price > state.data!.priceHistory[i - 1].price ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {ph.price < state.data!.priceHistory[i - 1].price ? '↓' : ph.price > state.data!.priceHistory[i - 1].price ? '↑' : '='}
                            {formatPrice(Math.abs(ph.price - state.data!.priceHistory[i - 1].price))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Comparable Listings */}
              {state.data?.comparables && state.data.comparables.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    🔄 Benzer Araçlar
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {state.data.comparables.slice(0, 5).map((comp) => (
                      <div
                        key={comp.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => onComparableClick(comp)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {comp.make} {comp.model} {comp.year}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {comp.mileageKm && <span>{turkishFormatter.format(comp.mileageKm)} km</span>}
                            {comp.fuelType && <span>• {comp.fuelType}</span>}
                            {comp.city && <span>• {comp.city}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <DealBadge tag={comp.dealTag} showIcon={false} />
                          <span className="font-semibold text-sm whitespace-nowrap">
                            {formatPrice(comp.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {detail.description && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">📝 Açıklama</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {detail.description}
                    </p>
                  </div>
                </>
              )}

              {/* Dates */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
                <span>İlk görülme: {formatDate(detail.firstSeenAt)}</span>
                <span>Son güncelleme: {formatDate(detail.lastSeenAt)}</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-dashed border-muted">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

// ── Favorite Toggle Button (for detail modal) ───────────────────────────

function FavoriteToggleButton({ listing }: { listing: ListingWithScore }) {
  const { isFavorite, toggleFavorite, hydrated } = useFavorites()
  const fav = hydrated && isFavorite(listing.id)

  return (
    <button
      onClick={() => toggleFavorite(listing.id)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
        fav
          ? 'bg-rose-500 text-white hover:bg-rose-600'
          : 'bg-muted hover:bg-muted/80 text-foreground'
      }`}
    >
      <Heart className={`h-4 w-4 ${fav ? 'fill-current' : ''}`} />
      <span className="hidden sm:inline">{fav ? 'Favorilerde' : 'Favori'}</span>
    </button>
  )
}
