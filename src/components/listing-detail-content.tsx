'use client'

// Otodedektif - İlan Detay Sayfası (AutoUncle-inspired layout)
//
// Düzen:
//   ┌─────────────────────────────────────┐  ┌──────────────┐
//   │  Breadcrumb                         │  │              │
//   │  Başlık (marka model)               │  │  Fiyat kutusu│
//   │  Alt başlık (yıl • km • yakıt)     │  │  - Fiyat     │
//   │                                     │  │  - Deal rozet│
//   │  ┌─────────────────────────┐        │  │  - Tahmini   │
//   │  │                         │        │  │  - CTA butonu│
//   │  │   Büyük görsel          │        │  │  - Favori   │
//   │  │                         │        │  │  - Paylaş   │
//   │  └─────────────────────────┘        │  │  - Kaynak   │
//   │  Spec satırları (grid 4'lü)        │  │              │
//   │                                     │  │  Quick info │
//   │  Tab: Özellikler / Değerlendirme   │  │  - Konum    │
//   │  İçerik (specs grid / fiyat an.)   │  │  - İlan no  │
//   │                                     │  │  - Tarih    │
//   │  Yakıt maliyeti hesaplama           │  │              │
//   │  Açıklama                           │  │  Kredi hes. │
//   │  Sahip olma maliyeti                │  │              │
//   │  Benzer ilanlar (yatay kart)        │  │              │
//   └─────────────────────────────────────┘  └──────────────┘

import { useEffect, useReducer, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Fuel, Gauge, MapPin, Settings2, Car, Calendar, Route, Palette, Building2,
  User, ExternalLink, TrendingDown, Shield, Wrench, Receipt, Droplets,
  Clock, Heart, Share2, ChevronRight, CheckCircle2, Info, Maximize2, X, ChevronLeft,
} from 'lucide-react'
import { DealBadge } from '@/components/deal-badge'
import { formatPrice } from '@/components/price-display'
import { StarRating } from '@/components/star-rating'
import { ShareButton } from '@/components/share-button'
import { LoanCalculator } from '@/components/loan-calculator'
import { FuelCostCalculator } from '@/components/fuel-cost-calculator'
import { DescriptionSummary } from '@/components/description-summary'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/auth/user-menu'
import { useFavorites } from '@/hooks/use-favorites'
import { SOURCE_PLATFORMS, DEAL_TAG_CONFIG } from '@/lib/constants'
import type { ListingWithScore } from '@/lib/types'

interface ListingDetailData {
  listing: ListingWithScore
  priceHistory: { id: string; price: number; recordedAt: string }[]
  comparables: ListingWithScore[]
}

interface DetailState {
  data: ListingDetailData | null
  loading: boolean
  currentId: string | null
  imgError: boolean
  activeImageIdx: number
  lightboxOpen: boolean
}

function detailReducer(state: DetailState, action: { type: string; payload?: unknown }): DetailState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, data: null, loading: true, currentId: action.payload as string, imgError: false }
    case 'FETCH_SUCCESS':
      return { ...state, data: action.payload as ListingDetailData, loading: false }
    case 'FETCH_ERROR':
      return { ...state, loading: false }
    case 'IMG_ERROR':
      return { ...state, imgError: true }
    case 'SET_IMAGE_IDX':
      return { ...state, activeImageIdx: action.payload as number }
    case 'OPEN_LIGHTBOX':
      return { ...state, lightboxOpen: true }
    case 'CLOSE_LIGHTBOX':
      return { ...state, lightboxOpen: false }
    case 'LIGHTBOX_NEXT':
      return { ...state, activeImageIdx: state.activeImageIdx + 1 }
    case 'LIGHTBOX_PREV':
      return { ...state, activeImageIdx: state.activeImageIdx - 1 }
    default:
      return state
  }
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

function SpecRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-right capitalize">{value}</span>
    </div>
  )
}

function FavoriteToggleButton({ listing, compact }: { listing: ListingWithScore; compact?: boolean }) {
  const { isFavorite, toggleFavorite, hydrated, isAuthenticated } = useFavorites()
  const fav = hydrated && isAuthenticated && isFavorite(listing.id)

  const handleClick = () => {
    if (!isAuthenticated) {
      window.location.href = '/auth/login?callbackUrl=' + encodeURIComponent(window.location.pathname + window.location.search)
      return
    }
    toggleFavorite(listing.id)
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center justify-center gap-2 rounded-lg font-medium transition-all cursor-pointer ${
        compact ? 'w-10 h-10' : 'w-full py-2.5'
      } ${
        fav
          ? 'bg-rose-500 text-white hover:bg-rose-600'
          : 'bg-muted hover:bg-muted/80 text-foreground border'
      }`}
      title={fav ? 'Favorilerden çıkar' : (isAuthenticated ? 'Favorilere ekle' : 'Favoriler için giriş yapın')}
    >
      <Heart className={`h-4 w-4 ${fav ? 'fill-current' : ''}`} />
      {!compact && <span>{fav ? 'Favorilerde' : (isAuthenticated ? 'Favori Ekle' : 'Giriş Yap')}</span>}
    </button>
  )
}

interface ListingDetailContentProps {
  initialListing: ListingWithScore
  listingId: string
}

export function ListingDetailContent({ initialListing, listingId }: ListingDetailContentProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(detailReducer, {
    data: null,
    loading: false,
    currentId: null,
    imgError: false,
    activeImageIdx: 0,
    lightboxOpen: false,
  })
  const [activeTab, setActiveTab] = useState<'specs' | 'evaluation' | 'history'>('specs')

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'FETCH_START', payload: listingId })
    fetch(`/api/listings/${listingId}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) dispatch({ type: 'FETCH_SUCCESS', payload: data })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'FETCH_ERROR' })
      })
    return () => { cancelled = true }
  }, [listingId])

  const source = getSourcePlatform(initialListing.sourceName)
  const detail = state.data?.listing || initialListing
  const detailHasImage = detail.imageUrl && !state.imgError

  // All available images (primary + extras)
  const allImages = detail.imageUrls && detail.imageUrls.length > 0
    ? detail.imageUrls
    : detail.imageUrl ? [detail.imageUrl] : []

  // Cost items
  const costItems: { label: string; amount: number; icon: React.ReactNode; color: string }[] = []
  if (detail.annualDepreciationAmount) {
    costItems.push({
      label: 'Yıllık Depresyasyon', amount: detail.annualDepreciationAmount,
      icon: <TrendingDown className="h-4 w-4 text-red-500" />, color: 'bg-red-400',
    })
  }
  if (detail.fuelCostAnnual) {
    costItems.push({
      label: 'Yakıt Maliyeti', amount: detail.fuelCostAnnual,
      icon: <Droplets className="h-4 w-4 text-amber-500" />, color: 'bg-amber-400',
    })
  }
  if (detail.insuranceCostAnnual) {
    costItems.push({
      label: 'Sigorta', amount: detail.insuranceCostAnnual,
      icon: <Shield className="h-4 w-4 text-blue-500" />, color: 'bg-blue-400',
    })
  }
  if (detail.maintenanceCostAnnual) {
    costItems.push({
      label: 'Bakım', amount: detail.maintenanceCostAnnual,
      icon: <Wrench className="h-4 w-4 text-orange-500" />, color: 'bg-orange-400',
    })
  }
  if (detail.taxCostAnnual) {
    costItems.push({
      label: 'Vergi (MTV)', amount: detail.taxCostAnnual,
      icon: <Receipt className="h-4 w-4 text-purple-500" />, color: 'bg-purple-400',
    })
  }
  const maxCost = Math.max(...costItems.map(c => c.amount), 1)

  const handleComparableClick = (listing: ListingWithScore) => {
    router.push(`/ilan/${listing.id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isGoodDeal = detail.dealTag === 'Harika Fırsat' || detail.dealTag === 'İyi Fırsat' || detail.dealTag === 'İyi Fiyat'
  const isBadDeal = detail.dealTag === 'Pahalı' || detail.dealTag === 'Piyasa Üstü'

  if (state.loading && !state.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">İlan detayları yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Sticky Header — ana sayfadaki ile birebir aynı */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 shrink-0">
            <Car className="h-6 w-6 text-orange-600" />
            <span className="text-base font-bold">
              <span className="text-orange-600">Oto</span>
              <span className="text-amber-500">dedektif</span>
            </span>
          </a>

          {/* Theme Toggle + User Menu */}
          <div className="shrink-0 flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <a href="/" className="hover:text-foreground transition-colors">Ana sayfa</a>
            <ChevronRight className="h-3 w-3" />
            <a href="/?tab=search" className="hover:text-foreground transition-colors">İlanlar</a>
            <ChevronRight className="h-3 w-3" />
            <a href={`/?make=${encodeURIComponent(detail.make)}`} className="hover:text-foreground transition-colors">{detail.make}</a>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate">{detail.make} {detail.model}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Main grid: sol içerik + sağ sidebar */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">

          {/* ─── SOL KOLON: Galeri + başlık + spec + tablar + bölümler ─── */}
          <div className="space-y-6 min-w-0">

            {/* Başlık (mobile'da görünür, desktop'ta hidden çünkü sağda fiyat var) */}
            <div className="lg:hidden">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  className="border-0 font-medium text-xs"
                  style={{ backgroundColor: source.color, color: '#ffffff' }}
                >
                  {source.icon} {source.displayName}
                </Badge>
                {detail.dealTag && <DealBadge tag={detail.dealTag} />}
              </div>
              <h1 className="text-2xl font-bold leading-tight">
                {detail.make} {detail.model}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {detail.year}
                {detail.trim ? ` • ${detail.trim}` : ''}
                {detail.mileageKm ? ` • ${turkishFormatter.format(detail.mileageKm)} km` : ''}
                {detail.fuelType ? ` • ${detail.fuelType}` : ''}
              </p>
            </div>

            {/* Galeri */}
            <div className="space-y-3">
              {/* Büyük görsel — tıklanınca lightbox açılır */}
              <div
                className={`relative aspect-[16/10] sm:aspect-[16/9] rounded-xl overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 group ${detailHasImage ? 'cursor-zoom-in' : 'flex items-center justify-center'}`}
                onClick={() => detailHasImage && dispatch({ type: 'OPEN_LIGHTBOX' })}
              >
                {detailHasImage ? (
                  <>
                    <img
                      src={allImages[state.activeImageIdx] || detail.imageUrl!}
                      alt={`${detail.make} ${detail.model}`}
                      className="w-full h-full object-cover"
                      onError={() => dispatch({ type: 'IMG_ERROR' })}
                      referrerPolicy="no-referrer"
                    />
                    {/* Zoom overlay — hover'da görünür */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-3 backdrop-blur-sm">
                        <Maximize2 className="h-5 w-5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                    <Car className="h-20 w-20 mb-2" />
                    <span className="text-sm">Görsel mevcut değil</span>
                  </div>
                )}

                {/* Source badge (desktop'ta burada, mobile'da yukarıda) */}
                <div className="hidden lg:flex absolute top-3 left-3 gap-2 pointer-events-none">
                  <Badge
                    className="border-0 font-medium text-xs backdrop-blur-sm"
                    style={{ backgroundColor: source.color, color: '#ffffff' }}
                  >
                    {source.icon} {source.displayName}
                  </Badge>
                </div>

                {/* Deal badge */}
                {detail.dealTag && (
                  <div className="absolute top-3 right-3 pointer-events-none">
                    <DealBadge tag={detail.dealTag} />
                  </div>
                )}

                {/* Image counter */}
                {allImages.length > 1 && (
                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium backdrop-blur-sm pointer-events-none">
                    {state.activeImageIdx + 1} / {allImages.length}
                  </div>
                )}
              </div>

              {/* Thumbnail'lar (eğer birden fazla görsel varsa) */}
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => dispatch({ type: 'SET_IMAGE_IDX', payload: idx })}
                      className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === state.activeImageIdx ? 'border-orange-600' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}

              {/* Fiyat kutusu — mobilde görselin hemen altında (lg ve üstünde gizli) */}
              <div className="lg:hidden">
                <PriceBox
                  detail={detail}
                  source={source}
                  isGoodDeal={isGoodDeal}
                  isBadDeal={isBadDeal}
                  listingId={listingId}
                  onRedirect={() => window.open(`/yonlendir/${listingId}`, '_blank', 'noopener,noreferrer')}
                />
              </div>
            </div>

            {/* Desktop başlık (mobile'da yukarıda gösterildi) */}
            <div className="hidden lg:block">
              <h1 className="text-3xl font-bold leading-tight">
                {detail.make} {detail.model}
              </h1>
              <p className="text-muted-foreground mt-1.5">
                {detail.year}
                {detail.trim ? ` • ${detail.trim}` : ''}
                {detail.mileageKm ? ` • ${turkishFormatter.format(detail.mileageKm)} km` : ''}
                {detail.fuelType ? ` • ${detail.fuelType}` : ''}
                {detail.transmission ? ` • ${detail.transmission}` : ''}
              </p>
            </div>

            {/* Quick specs — 4'lü ikon grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickSpecCard
                icon={<Calendar className="h-5 w-5 text-orange-600" />}
                label="Model Yılı"
                value={detail.year.toString()}
              />
              {detail.mileageKm != null && (
                <QuickSpecCard
                  icon={<Route className="h-5 w-5 text-orange-600" />}
                  label="Kilometre"
                  value={`${turkishFormatter.format(detail.mileageKm)} km`}
                />
              )}
              {detail.fuelType && (
                <QuickSpecCard
                  icon={<Fuel className="h-5 w-5 text-orange-600" />}
                  label="Yakıt"
                  value={detail.fuelType}
                />
              )}
              {detail.transmission && (
                <QuickSpecCard
                  icon={<Settings2 className="h-5 w-5 text-orange-600" />}
                  label="Vites"
                  value={detail.transmission}
                />
              )}
            </div>

            {/* Tablar: Özellikler / Değerlendirme / Fiyat Geçmişi */}
            <div className="border-b">
              <div className="flex gap-1 -mb-px overflow-x-auto min-w-0">
                <TabButton active={activeTab === 'specs'} onClick={() => setActiveTab('specs')}>
                  📋 Özellikler
                </TabButton>
                <TabButton active={activeTab === 'evaluation'} onClick={() => setActiveTab('evaluation')}>
                  📊 Değerlendirme
                  {detail.dealScore !== null && detail.dealScore !== undefined && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({Math.round(detail.dealScore * 100)}%)
                    </span>
                  )}
                </TabButton>
                <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
                  📈 Fiyat Geçmişi
                  {state.data?.priceHistory && state.data.priceHistory.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({state.data.priceHistory.length})
                    </span>
                  )}
                </TabButton>
              </div>
            </div>

            {/* Tab içeriği */}
            <div className="min-h-[200px]">
              {activeTab === 'specs' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                  <div className="grid sm:grid-cols-2 gap-1">
                    <SpecRow label="Marka" value={detail.make} icon={<Car className="h-4 w-4" />} />
                    <SpecRow label="Model" value={detail.model} icon={<Car className="h-4 w-4" />} />
                    <SpecRow label="Model Yılı" value={detail.year.toString()} icon={<Calendar className="h-4 w-4" />} />
                    <SpecRow label="Kilometre" value={detail.mileageKm ? `${turkishFormatter.format(detail.mileageKm)} km` : '-'} icon={<Route className="h-4 w-4" />} />
                    <SpecRow label="Yakıt Tipi" value={detail.fuelType || '-'} icon={<Fuel className="h-4 w-4" />} />
                    <SpecRow label="Vites" value={detail.transmission || '-'} icon={<Settings2 className="h-4 w-4" />} />
                    <SpecRow label="Kasa Tipi" value={detail.bodyType || '-'} icon={<Car className="h-4 w-4" />} />
                    <SpecRow label="Renk" value={detail.color || '-'} icon={<Palette className="h-4 w-4" />} />
                    <SpecRow label="Şehir" value={detail.city || '-'} icon={<MapPin className="h-4 w-4" />} />
                    <SpecRow label="İlçe" value={detail.district || '-'} icon={<Building2 className="h-4 w-4" />} />
                    <SpecRow label="Satıcı Tipi" value={detail.sellerType || '-'} icon={<User className="h-4 w-4" />} />
                    <SpecRow label="Kaynak" value={source.displayName} icon={<ExternalLink className="h-4 w-4" />} />
                  </div>
                </motion.div>
              )}

              {activeTab === 'evaluation' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Deal summary card */}
                  <div className={`p-4 rounded-xl border ${
                    isGoodDeal ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
                    : isBadDeal ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
                    : 'bg-muted/50 border-muted'
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Otodedektif Değerlendirmesi</p>
                        <div className="flex items-center gap-2">
                          {detail.dealTag && <DealBadge tag={detail.dealTag} />}
                          <StarRating dealScore={detail.dealScore} confidence={detail.confidence} size="sm" />
                        </div>
                      </div>
                      {detail.dealScore !== null && detail.dealScore !== undefined && (
                        <div className="text-right">
                          <p className="text-2xl font-bold">{Math.round(detail.dealScore * 100)}%</p>
                          <p className="text-xs text-muted-foreground">Fırsat Skoru</p>
                        </div>
                      )}
                    </div>
                    {detail.dealTag && DEAL_TAG_CONFIG[detail.dealTag] && (
                      <p className="text-sm text-muted-foreground">
                        {detail.dealTag === 'Harika Fırsat' && '✓ Bu araç piyasa değerinin önemli ölçüde altında fiyatlandırılmış. Hemen değerlendirin!'}
                        {detail.dealTag === 'İyi Fiyat' && '✓ Bu araç piyasa değerinin altında fiyatlandırılmış. İyi bir fırsat olabilir.'}
                        {detail.dealTag === 'Piyasa Fiyatı' && 'Bu araç piyasa değerine uygun fiyatlandırılmış.'}
                        {detail.dealTag === 'Piyasa Üstü' && 'Bu araç piyasa değerinin üzerinde. Pazarlık yapmayı deneyebilirsiniz.'}
                        {detail.dealTag === 'Pahalı' && 'Bu araç piyasa değerinin önemli ölçüde üzerinde. Dikkatli olun.'}
                        {detail.dealTag === 'Değerlendirilemedi' && 'Bu araç için yeterli karşılaştırma verisi bulunamadı.'}
                      </p>
                    )}
                  </div>

                  {/* Evaluation breakdown */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {detail.estimatedValue && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Tahmini Piyasa Değeri</p>
                        <p className="text-lg font-bold">{formatPrice(detail.estimatedValue)}</p>
                        {detail.price && detail.estimatedValue && (
                          <p className={`text-xs mt-1 ${detail.price < detail.estimatedValue ? 'text-green-600' : 'text-red-500'}`}>
                            {detail.price < detail.estimatedValue
                              ? `${formatPrice(detail.estimatedValue - detail.price)} altında`
                              : `${formatPrice(detail.price - detail.estimatedValue)} üstünde`}
                          </p>
                        )}
                      </div>
                    )}
                    {detail.confidence && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Güven Seviyesi</p>
                        <p className="text-lg font-bold">
                          {detail.confidence === 'high' ? 'Yüksek' : detail.confidence === 'medium' ? 'Orta' : detail.confidence === 'low' ? 'Düşük' : 'Yetersiz'}
                        </p>
                        {detail.comparableCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">{detail.comparableCount} karşılaştırma verisi</p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {state.data?.priceHistory && state.data.priceHistory.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        {state.data.priceHistory.slice(0, 10).map((ph, i) => (
                          <div key={ph.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-32">
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
                    </>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Bu ilan için fiyat geçmişi bulunmuyor.
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            <Separator />

            {/* Yakıt maliyeti hesaplama */}
            <div>
              <FuelCostCalculator
                listingId={listingId}
                defaultCity={detail.city}
                fuelType={detail.fuelType}
              />
            </div>

            <Separator />

            {/* Sahip olma maliyeti */}
            {costItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    💰 Sahip Olma Maliyeti
                  </h2>
                  <span className="text-xs text-muted-foreground">Yıllık tahmini</span>
                </div>
                {detail.ownershipCostAnnual && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-900">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Toplam yıllık sahip olma maliyeti: <span className="font-bold text-base">{formatPrice(detail.ownershipCostAnnual)}</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">(~{formatPrice(detail.ownershipCostAnnual / 12)}/ay)</span>
                    </p>
                    {detail.annualDepreciationPercent && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
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

            {/* Açıklama */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">📝 Açıklama</h2>
              <DescriptionSummary description={detail.description} listing={detail} />
              {detail.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {detail.description}
                </p>
              )}
            </div>

            <Separator />

            {/* Benzer ilanlar */}
            {state.data?.comparables && state.data.comparables.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  🔄 Benzer Araçlar
                  <span className="text-sm text-muted-foreground font-normal">({state.data.comparables.length})</span>
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {state.data.comparables.slice(0, 8).map((comp) => (
                    <button
                      key={comp.id}
                      onClick={() => handleComparableClick(comp)}
                      className="flex gap-3 p-3 border rounded-xl hover:shadow-md hover:border-orange-300 transition-all text-left group cursor-pointer max-w-full overflow-hidden"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {comp.imageUrl ? (
                          <img src={comp.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Car className="h-6 w-6 text-muted-foreground" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-orange-600 transition-colors">
                          {comp.make} {comp.model} {comp.year}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {comp.mileageKm && <span>{turkishFormatter.format(comp.mileageKm)} km</span>}
                          {comp.fuelType && <span>• {comp.fuelType}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="font-bold text-sm text-orange-700">{formatPrice(comp.price)}</span>
                          <DealBadge tag={comp.dealTag} showIcon={false} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── SAĞ KOLON: Sidebar (sticky) ─── */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20 space-y-4">

              {/* Fiyat kutusu — desktop'ta sidebar'da */}
              <div className="hidden lg:block">
                <PriceBox
                  detail={detail}
                  source={source}
                  isGoodDeal={isGoodDeal}
                  isBadDeal={isBadDeal}
                  listingId={listingId}
                  onRedirect={() => window.open(`/yonlendir/${listingId}`, '_blank', 'noopener,noreferrer')}
                />
              </div>

              {/* Hızlı bilgi kutusu */}
              <div className="rounded-xl border bg-card p-4 space-y-2.5">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">İlan Bilgileri</h3>
                <InfoRow icon={<MapPin className="h-4 w-4 text-muted-foreground" />} label="Konum" value={detail.city ? `${detail.city}${detail.district ? ` / ${detail.district}` : ''}` : '-'} />
                <InfoRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="Satıcı" value={detail.sellerType || '-'} />
                <InfoRow icon={<Car className="h-4 w-4 text-muted-foreground" />} label="Kaynak" value={source.displayName} />
                <InfoRow icon={<Clock className="h-4 w-4 text-muted-foreground" />} label="İlan tarihi" value={formatDate(detail.firstSeenAt)} />
                {detail.lastSeenAt && detail.lastSeenAt !== detail.firstSeenAt && (
                  <InfoRow icon={<Clock className="h-4 w-4 text-muted-foreground" />} label="Son güncelleme" value={formatDate(detail.lastSeenAt)} />
                )}
              </div>

              {/* Kredi hesaplayıcı */}
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">Kredi Hesaplayıcı</h3>
                <LoanCalculator price={detail.price} compact />
              </div>

              {/* Bilgi notu */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    Fiyat ve bilgi güncelliği için kaynak siteyi kontrol edin. Otodedektif sadece karşılaştırma platformudur.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Lightbox — resme tıklanınca tam ekran galeri */}
      {state.lightboxOpen && detailHasImage && (
        <LightboxModal
          images={allImages}
          currentIdx={state.activeImageIdx}
          alt={`${detail.make} ${detail.model}`}
          onClose={() => dispatch({ type: 'CLOSE_LIGHTBOX' })}
          onNext={() => dispatch({ type: 'LIGHTBOX_NEXT' })}
          onPrev={() => dispatch({ type: 'LIGHTBOX_PREV' })}
          onIdxChange={(idx) => dispatch({ type: 'SET_IMAGE_IDX', payload: idx })}
        />
      )}
    </div>
  )
}

// ── Yardımcı component'ler ─────────────────────────────────────────────

function QuickSpecCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-card border">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
        active
          ? 'border-orange-600 text-orange-700 dark:text-orange-400'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium text-right truncate capitalize">{value}</span>
    </div>
  )
}

// ── Fiyat kutusu (mobilde görsel altında, desktop'ta sidebar'da) ────────
// Aynı içerik iki yerde render edildiği için ayrı bir component'e çıkarıldı.
function PriceBox({
  detail,
  source,
  isGoodDeal,
  isBadDeal,
  listingId,
  onRedirect,
}: {
  detail: ListingWithScore
  source: ReturnType<typeof getSourcePlatform>
  isGoodDeal: boolean
  isBadDeal: boolean
  listingId: string
  onRedirect: () => void
}) {
  return (
    <div className={`rounded-2xl border-2 p-5 ${
      isGoodDeal ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800'
      : isBadDeal ? 'border-red-200 bg-red-50/30 dark:bg-red-950/10 dark:border-red-900'
      : 'border-border bg-card'
    }`}>
      {/* Price */}
      <div className="mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">İlan Fiyatı</p>
        <p className={`text-3xl font-extrabold ${
          isGoodDeal ? 'text-green-700 dark:text-green-400'
          : isBadDeal ? 'text-red-600 dark:text-red-400'
          : 'text-foreground'
        }`}>
          {formatPrice(detail.price)}
        </p>
        {detail.estimatedValue && detail.estimatedValue !== detail.price && (
          <p className="text-xs text-muted-foreground mt-1">
            Tahmini: {formatPrice(detail.estimatedValue)}
            {detail.price < detail.estimatedValue && (
              <span className="text-green-600 ml-1">
                ({Math.round((1 - detail.price / detail.estimatedValue) * 100)}% altında)
              </span>
            )}
            {detail.price > detail.estimatedValue && (
              <span className="text-red-500 ml-1">
                ({Math.round((detail.price / detail.estimatedValue - 1) * 100)}% üstünde)
              </span>
            )}
          </p>
        )}
      </div>

      {/* Deal badge */}
      {detail.dealTag && (
        <div className="mb-4">
          <DealBadge tag={detail.dealTag} />
        </div>
      )}

      {/* CTA: Kaynakta gör — yönlendirme sayfası üzerinden açılır */}
      <Button
        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold mb-2 cursor-pointer"
        onClick={onRedirect}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        <span>Kaynakta Gör</span>
        <span className="ml-1 opacity-90 font-normal">· {source.displayName}</span>
      </Button>

      {/* Favori + Paylaş */}
      <div className="grid grid-cols-2 gap-2">
        <FavoriteToggleButton listing={detail} />
        <ShareButton
          url={typeof window !== 'undefined' ? window.location.href : `/ilan/${listingId}`}
          title={`${detail.make} ${detail.model} ${detail.year} - ${formatPrice(detail.price)}`}
          variant="button"
          size="md"
        />
      </div>
    </div>
  )
}

// ── Lightbox modal — tam ekran galeri ──────────────────────────────────
// Klavye desteği: Esc=kapat, ←/→=önceki/sonraki
function LightboxModal({
  images,
  currentIdx,
  alt,
  onClose,
  onNext,
  onPrev,
  onIdxChange,
}: {
  images: string[]
  currentIdx: number
  alt: string
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onIdxChange: (idx: number) => void
}) {
  // Bound check — son görselde "next" başa döner, ilk görselde "prev" sona gider
  const safeIdx = ((currentIdx % images.length) + images.length) % images.length
  const hasMultiple = images.length > 1

  // Klavye desteği
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && hasMultiple) onNext()
      else if (e.key === 'ArrowLeft' && hasMultiple) onPrev()
    }
    window.addEventListener('keydown', handleKey)
    // Lightbox açıkken arka plan scroll'unu kapat
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose, onNext, onPrev, hasMultiple])

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Kapat butonu */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Kapat"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Görsel sayacı */}
      {hasMultiple && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-medium backdrop-blur-sm">
          {safeIdx + 1} / {images.length}
        </div>
      )}

      {/* Önceki butonu */}
      {hasMultiple && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Önceki görsel"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      {/* Büyük görsel — tıklama propagation'ı durdur ki kapanmasın */}
      <div
        className="max-w-[95vw] max-h-[95vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[safeIdx]}
          alt={alt}
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Sonraki butonu */}
      {hasMultiple && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Sonraki görsel"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      {/* Thumbnail strip (altta) */}
      {hasMultiple && (
        <div
          className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => onIdxChange(idx)}
              className={`flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${
                idx === safeIdx ? 'border-orange-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
