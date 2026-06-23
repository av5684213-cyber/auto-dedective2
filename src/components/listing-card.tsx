'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Fuel, Gauge, MapPin, Settings2, Car, Heart } from 'lucide-react'
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
    name: sourceName,
    displayName: sourceName,
    color: '#6b7280',
    icon: '🔗',
  }
}

function getDealScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-gray-200'
  if (score >= 0.6) return 'bg-green-500'
  if (score >= 0.3) return 'bg-lime-500'
  if (score >= 0) return 'bg-yellow-400'
  if (score >= -0.3) return 'bg-orange-400'
  return 'bg-red-500'
}

export function ListingCard({ listing, onClick, index = 0 }: ListingCardProps) {
  const source = getSourcePlatform(listing.sourceName)
  const [imgError, setImgError] = useState(false)
  const { isFavorite, toggleFavorite, hydrated } = useFavorites()
  const fav = hydrated && isFavorite(listing.id)

  const gradientColors: Record<string, string> = {
    'BMW': 'from-blue-900 to-slate-700',
    'Mercedes-Benz': 'from-gray-800 to-gray-600',
    'Audi': 'from-red-900 to-gray-800',
    'Volkswagen': 'from-blue-800 to-blue-600',
    'Toyota': 'from-red-700 to-gray-700',
    'Honda': 'from-blue-700 to-slate-600',
    'Hyundai': 'from-blue-600 to-gray-600',
    'Ford': 'from-blue-900 to-blue-700',
    'Renault': 'from-yellow-700 to-gray-600',
    'Fiat': 'from-red-600 to-gray-600',
  }
  const gradient = gradientColors[listing.make] || 'from-orange-700 to-slate-600'
  const hasImage = listing.imageUrl && !imgError

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(listing.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="cursor-pointer"
      onClick={() => onClick(listing)}
    >
      <Card className="overflow-hidden border hover:shadow-lg transition-shadow duration-300 h-full flex flex-col relative">
        {/* Favorite + Share Buttons */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          <ShareButton
            url={listing.sourceUrl}
            title={`${listing.make} ${listing.model} ${listing.year} - ${listing.price.toLocaleString('tr-TR')} TL`}
            size="sm"
          />
          <button
            onClick={handleFavoriteClick}
            className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${
              fav
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : 'bg-white/80 text-gray-600 hover:bg-white hover:text-rose-500'
            }`}
            aria-label={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          >
            <Heart className={`h-4 w-4 ${fav ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Image */}
        <div className={`relative h-40 ${hasImage ? '' : `bg-gradient-to-br ${gradient}`} flex items-center justify-center overflow-hidden`}>
          {hasImage ? (
            <img
              src={listing.imageUrl!}
              alt={`${listing.make} ${listing.model}`}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              loading="lazy"
            />
          ) : (
            <Car className="h-16 w-16 text-white/20" />
          )}

          {/* Deal Tag */}
          {listing.dealTag && (
            <div className="absolute top-2 left-2">
              <DealBadge tag={listing.dealTag} />
            </div>
          )}

          {/* Deal Score Indicator (below favorite/share buttons) */}
          {listing.dealScore !== null && listing.dealScore !== undefined && (
            <div className="absolute bottom-14 right-2">
              <div className="bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${getDealScoreColor(listing.dealScore)}`} />
                <span className="text-white text-xs font-medium">
                  {Math.round(listing.dealScore * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Source Badge */}
          <div className="absolute bottom-2 right-2">
            <Badge
              className="text-[10px] h-5 border-0 font-medium"
              style={{ backgroundColor: source.color, color: '#ffffff' }}
            >
              {source.icon} {source.displayName || listing.sourceName}
            </Badge>
          </div>

          {/* Seller Type Badge */}
          {listing.sellerType && (
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-[10px] h-5 bg-white/90 text-gray-700">
                {listing.sellerType}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 flex flex-col flex-1">
          {/* Title */}
          <div className="mb-2">
            <h3 className="font-semibold text-sm line-clamp-1">
              {listing.make} {listing.model}
            </h3>
            <p className="text-xs text-muted-foreground">{listing.year}{listing.trim ? ` • ${listing.trim}` : ''}</p>
          </div>

          {/* Price */}
          <PriceDisplay
            price={listing.price}
            estimatedValue={listing.estimatedValue}
            dealTag={listing.dealTag}
            size="sm"
            className="mb-1.5"
          />

          {/* Star Rating */}
          <div className="mb-3">
            <StarRating
              dealScore={listing.dealScore}
              confidence={listing.confidence}
              size="sm"
            />
          </div>

          {/* Specs */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-auto">
            {listing.mileageKm !== null && listing.mileageKm !== undefined && (
              <div className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                {turkishFormatter.format(listing.mileageKm)} km
              </div>
            )}
            {listing.fuelType && (
              <div className="flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                {listing.fuelType}
              </div>
            )}
            {listing.transmission && (
              <div className="flex items-center gap-1">
                <Settings2 className="h-3 w-3" />
                {listing.transmission}
              </div>
            )}
            {listing.city && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {listing.city}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
