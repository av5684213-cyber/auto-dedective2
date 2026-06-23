'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Heart, Trash2, GitCompare, Car, ExternalLink, X, ArrowRight,
  Gauge, Fuel, MapPin, Settings2, Calendar, Coins,
} from 'lucide-react'
import { DealBadge } from '@/components/deal-badge'
import { formatPrice } from '@/components/price-display'
import { SOURCE_PLATFORMS } from '@/lib/constants'
import { useFavorites } from '@/hooks/use-favorites'
import { CompareModal } from '@/components/compare-modal'
import type { ListingWithScore } from '@/lib/types'

const turkishFormatter = new Intl.NumberFormat('tr-TR')

function getSourcePlatform(sourceName: string) {
  return SOURCE_PLATFORMS.find((s) => s.name === sourceName) || {
    name: sourceName, displayName: sourceName,
    color: '#6b7280', icon: '🔗',
  }
}

export function FavoritesPanel() {
  const { favorites, favoriteIds, count, removeFavorite, clearAll, hydrated } = useFavorites()
  const [listings, setListings] = useState<ListingWithScore[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  // Fetch favorited listings.
  //
  // CRITICAL: We use favoriteIds.join(',') as the dependency key (a primitive
  // string) instead of favoriteIds (an array). This prevents infinite loops
  // because join(',') only changes when the actual IDs change, not when the
  // array reference changes.
  const favoriteIdsKey = favoriteIds.join(',')

  const fetchListings = useCallback(async () => {
    if (!hydrated || favoriteIds.length === 0) {
      setListings([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: favoriteIds }),
      })
      if (!res.ok) {
        console.error('Favorites API error:', res.status)
        setListings([])
        return
      }
      const data = await res.json()
      setListings(data.listings || [])
    } catch (err) {
      console.error('Failed to fetch favorites:', err)
      setListings([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteIdsKey, hydrated])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  // Filter out selected IDs that no longer exist in favorites.
  // Uses favoriteIdsKey (primitive string) to avoid re-render loops.
  useEffect(() => {
    setSelectedForCompare((prev) => prev.filter((id) => favoriteIds.includes(id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteIdsKey])

  const handleToggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id)
      }
      if (prev.length >= 2) {
        // Replace the first one
        return [prev[1], id]
      }
      return [...prev, id]
    })
  }

  const handleCompare = () => {
    if (selectedForCompare.length !== 2) return
    setCompareOpen(true)
  }

  const handleRemove = (id: string) => {
    removeFavorite(id)
    setSelectedForCompare((prev) => prev.filter((x) => x !== id))
  }

  // Loading state
  if (!hydrated || loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 pt-6">
        <div className="flex items-center gap-2 mb-6">
          <Heart className="h-5 w-5 text-rose-500" />
          <h2 className="text-xl font-bold">Favorilerim</h2>
          <Badge variant="secondary">Yükleniyor...</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (count === 0) {
    return (
      <div className="max-w-5xl mx-auto p-4 pt-6">
        <div className="flex items-center gap-2 mb-6">
          <Heart className="h-5 w-5 text-rose-500" />
          <h2 className="text-xl font-bold">Favorilerim</h2>
          <Badge variant="secondary">{count} ilan</Badge>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Heart className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              Henüz favori ilan yok
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              İlan kartlarındaki kalp ikonuna tıklayarak favorilere ekleyin.
              En fazla 20 ilan favoriye eklenebilir. Favorilere eklediğiniz
              ilanları yan yana karşılaştırabilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500 fill-current" />
          <h2 className="text-xl font-bold">Favorilerim</h2>
          <Badge variant="secondary">{count} ilan</Badge>
        </div>

        <div className="flex items-center gap-2">
          {selectedForCompare.length === 2 && (
            <Button
              onClick={handleCompare}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 gap-1.5"
            >
              <GitCompare className="h-4 w-4" />
              Karşılaştır
            </Button>
          )}
          <Button
            onClick={() => {
              if (confirm('Tüm favoriler silinsin mi?')) {
                clearAll()
                setSelectedForCompare([])
              }
            }}
            variant="outline"
            size="sm"
            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Tümünü Sil
          </Button>
        </div>
      </div>

      {/* Compare selection hint */}
      {selectedForCompare.length === 1 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Karşılaştırma için bir ilan daha seçin ({selectedForCompare.length}/2)
        </div>
      )}

      {/* Favorites grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {listings.map((listing, index) => {
            const isSelected = selectedForCompare.includes(listing.id)
            const source = getSourcePlatform(listing.sourceName)

            return (
              <motion.div
                key={listing.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`overflow-hidden transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-orange-500 border-orange-500'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleToggleCompare(listing.id)}
                >
                  <div className="flex gap-3 p-3">
                    {/* Image */}
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                      {listing.imageUrl ? (
                        <img
                          src={listing.imageUrl}
                          alt={`${listing.make} ${listing.model}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <Car className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">
                            {listing.make} {listing.model}
                          </h3>
                          <p className="text-xs text-muted-foreground">{listing.year}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            className="text-[9px] h-4 border-0"
                            style={{ backgroundColor: source.color, color: '#fff' }}
                          >
                            {source.icon} {source.displayName}
                          </Badge>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-lg font-bold text-orange-700 mb-1">
                        {formatPrice(listing.price)}
                      </div>

                      {/* Deal tag */}
                      {listing.dealTag && (
                        <div className="mb-1.5">
                          <DealBadge tag={listing.dealTag} />
                        </div>
                      )}

                      {/* Specs */}
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        {listing.mileageKm != null && (
                          <span className="flex items-center gap-0.5">
                            <Gauge className="h-2.5 w-2.5" />
                            {turkishFormatter.format(listing.mileageKm)} km
                          </span>
                        )}
                        {listing.fuelType && (
                          <span className="flex items-center gap-0.5">
                            <Fuel className="h-2.5 w-2.5" />
                            {listing.fuelType}
                          </span>
                        )}
                        {listing.transmission && (
                          <span className="flex items-center gap-0.5">
                            <Settings2 className="h-2.5 w-2.5" />
                            {listing.transmission}
                          </span>
                        )}
                        {listing.city && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {listing.city}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t">
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <Badge className="bg-orange-600 text-white gap-1">
                          <GitCompare className="h-3 w-3" />
                          Karşılaştırmada
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <GitCompare className="h-3 w-3" />
                          Karşılaştırmak için seç
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <a
                        href={listing.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-orange-600"
                        title="Kaynakta gör"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemove(listing.id)
                        }}
                        className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                        title="Favorilerden çıkar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Not found note */}
      {listings.length < count && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          {count - listings.length} favori ilan artık mevcut değil (silinmiş veya kaldırılmış olabilir).
        </div>
      )}

      {/* Compare Modal */}
      <CompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        ids={selectedForCompare.length === 2 ? [selectedForCompare[0], selectedForCompare[1]] : null}
      />
    </div>
  )
}
