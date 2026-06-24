'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Fuel, Gauge, MapPin, Settings2, Car, Heart, Clock } from 'lucide-react'
import { DealBadge } from '@/components/deal-badge'
import { PriceDisplay } from '@/components/price-display'
import { StarRating } from '@/components/star-rating'
import { ShareButton } from '@/components/share-button'
import { SOURCE_PLATFORMS } from '@/lib/constants'
import { useFavorites } from '@/hooks/use-favorites'
import type { ListingWithScore } from '@/lib/types'

interface ListingCardProps {
  listing: ListingWithScore
  onClick: (listing: ListingWithScore) => void
  index?: number
}

const turkishFormatter = new Intl.NumberFormat('tr-TR')

function getSourcePlatform(sourceName: string) {
  return SOURCE_PLATFORMS.find(s => s.name === sourceName) || {
    name: sourceName, displayName: sourceName, color: '#6b7280', icon: '🔗',
  }
}

function getDealScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-gray-400'
  if (score < -0.15) return 'bg-green-500'
  if (score < -0.05) return 'bg-lime-500'
  if (score < 0.05) return 'bg-amber-500'
  if (score < 0.15) return 'bg-orange-500'
  return 'bg-red-500'
}

// İlan yaşı hesaplama
function getListingAge(firstSeenAt: string): { days: number; label: string; color: string } | null {
  try {
    const seen = new Date(firstSeenAt)
    const now = new Date()
    const days = Math.floor((now.getTime() - seen.getTime()) / (1000 * 60 * 60 * 24))
    if (days >= 30) {
      return { days, label: `${days} gündür satılmıyor`, color: 'text-amber-400' }
    }
    if (days >= 14) {
      return { days, label: `${days} gün`, color: 'text-yellow-400' }
    }
    return null
  } catch { return null }
}

export function ListingCard({ listing, onClick, index = 0 }: ListingCardProps) {
  const source = getSourcePlatform(listing.sourceName)
  const [imgError, setImgError] = useState(false)
  const { isFavorite, toggleFavorite, hydrated } = useFavorites()
  const fav = hydrated && isFavorite(listing.id)

  const listingAge = useMemo(() => getListingAge(listing.firstSeenAt), [listing.firstSeenAt])

  // Piyasa farkı
  const marketDiff = useMemo(() => {
    if (!listing.estimatedValue || listing.estimatedValue <= 0) return null
    const diff = ((listing.price - listing.estimatedValue) / listing.estimatedValue) * 100
    return diff
  }, [listing.price, listing.estimatedValue])

  const gradientColors: Record<string, string> = {
    'BMW': 'from-blue-900 to-slate-800',
    'Mercedes-Benz': 'from-gray-800 to-gray-700',
    'Audi': 'from-red-900 to-gray-800',
    'Volkswagen': 'from-blue-800 to-blue-700',
    'Toyota': 'from-red-800 to-gray-700',
    'Honda': 'from-blue-700 to-slate-700',
    'Hyundai': 'from-blue-600 to-gray-700',
    'Ford': 'from-blue-900 to-blue-800',
    'Renault': 'from-yellow-800 to-gray-700',
    'Fiat': 'from-red-700 to-gray-700',
  }
  const gradient = gradientColors[listing.make] || 'from-orange-800 to-slate-800'
  const hasImage = listing.imageUrl && !imgError

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(listing.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      className="cursor-pointer"
      onClick={() => onClick(listing)}
    >
      <Card className="overflow-hidden border border-[#2A2A2A] hover:border-[#F15A24]/50 hover:shadow-xl hover:shadow-[#F15A24]/5 transition-all duration-200 h-full flex flex-col relative rounded-xl bg-[#1A1A1A]">

        {/* Image */}
        <div className={`relative aspect-[16/10] ${hasImage ? '' : `bg-gradient-to-br ${gradient}`} flex items-center justify-center overflow-hidden`}>
          {hasImage ? (
            <img
              src={listing.imageUrl!}
              alt={`${listing.make} ${listing.model}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : (
            <Car className="h-16 w-16 text-white/10" />
          )}

          {/* Deal Tag — sol üst */}
          {listing.dealTag && listing.dealTag !== 'Değerlendirilemedi' && (
            <div className="absolute top-2 left-2 z-10">
              <DealBadge tag={listing.dealTag} />
            </div>
          )}

          {/* Favori + Paylaş — sağ üst */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <ShareButton
              url={listing.sourceUrl}
              title={`${listing.make} ${listing.model} ${listing.year} - ${listing.price.toLocaleString('tr-TR')} TL`}
              size="sm"
            />
            <button
              onClick={handleFavoriteClick}
              className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${
                fav
                  ? 'bg-[#F15A24] text-white hover:bg-[#F15A24]/80'
                  : 'bg-black/50 text-white hover:bg-black/70 hover:text-[#F15A24]'
              }`}
              aria-label={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            >
              <Heart className={`h-4 w-4 ${fav ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Platform kaynak chip — sol alt */}
          <div className="absolute bottom-2 left-2 z-10">
            <Badge
              className="text-[10px] h-5 border-0 font-medium backdrop-blur-sm"
              style={{ backgroundColor: `${source.color}DD`, color: '#ffffff' }}
            >
              {source.icon} {source.displayName || listing.sourceName}
            </Badge>
          </div>

          {/* İlan yaşı badge — sağ alt (30+ gün) */}
          {listingAge && (
            <div className="absolute bottom-2 right-2 z-10">
              <Badge className="text-[10px] h-5 border-0 bg-black/60 text-amber-400 backdrop-blur-sm gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {listingAge.label}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 flex flex-col flex-1 gap-1.5">
          {/* Title */}
          <div>
            <h3 className="font-bold text-sm line-clamp-1 text-white">
              {listing.make} {listing.model}
            </h3>
            <p className="text-xs text-[#A0A0A0]">{listing.year}{listing.trim ? ` • ${listing.trim}` : ''}</p>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono-data text-white">
              {turkishFormatter.format(listing.price)} TL
            </span>
          </div>

          {/* Piyasa farkı */}
          {marketDiff !== null && Math.abs(marketDiff) > 1 && (
            <div className={`text-xs font-medium ${marketDiff < 0 ? 'text-green-500' : 'text-red-500'}`}>
              {marketDiff < 0 ? '↓' : '↑'} Piyasanın %{Math.abs(marketDiff).toFixed(0)} {marketDiff < 0 ? 'altında' : 'üstünde'}
            </div>
          )}

          {/* Star Rating */}
          <StarRating
            dealScore={listing.dealScore}
            confidence={listing.confidence}
            size="sm"
          />

          {/* Specs */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#A0A0A0] mt-auto pt-1.5">
            {listing.mileageKm != null && (
              <span className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                {turkishFormatter.format(listing.mileageKm)} km
              </span>
            )}
            {listing.fuelType && (
              <span className="flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                {listing.fuelType}
              </span>
            )}
            {listing.transmission && (
              <span className="flex items-center gap-1">
                <Settings2 className="h-3 w-3" />
                {listing.transmission}
              </span>
            )}
            {listing.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {listing.city}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
