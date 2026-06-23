'use client'

import { Star } from 'lucide-react'

// ── Star Rating Component (Otouncle-style) ──────────────────────────────
//
// Converts dealScore (-1 to 1) into 0-5 stars:
//   ★★★★★ (5) — Harika Fırsat (score < -0.15)
//   ★★★★☆ (4) — İyi Fiyat (score < -0.05)
//   ★★★☆☆ (3) — Piyasa Fiyatı (score < 0.05)
//   ★★☆☆☆ (2) — Piyasa Üstü (score < 0.15)
//   ★☆☆☆☆ (1) — Pahalı (score >= 0.15)
//   ☆☆☆☆☆ (0) — Değerlendirilemedi (no score)

interface StarRatingProps {
  dealScore?: number | null
  dealTag?: string | null
  confidence?: string | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function scoreToStars(score: number | null | undefined): number {
  if (score === null || score === undefined) return 0
  if (score < -0.15) return 5
  if (score < -0.05) return 4
  if (score < 0.05) return 3
  if (score < 0.15) return 2
  return 1
}

const STAR_LABELS: Record<number, { text: string; color: string }> = {
  5: { text: 'Harika Fırsat', color: 'text-green-600' },
  4: { text: 'İyi Fiyat', color: 'text-lime-600' },
  3: { text: 'Piyasa Fiyatı', color: 'text-amber-600' },
  2: { text: 'Piyasa Üstü', color: 'text-orange-600' },
  1: { text: 'Pahalı', color: 'text-red-600' },
  0: { text: 'Değerlendirilemedi', color: 'text-gray-400' },
}

export function StarRating({
  dealScore,
  dealTag,
  confidence,
  size = 'sm',
  showLabel = true,
}: StarRatingProps) {
  const stars = scoreToStars(dealScore)
  const label = STAR_LABELS[stars]

  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm'

  // Low confidence → reduce visual weight
  const isLowConfidence = confidence === 'low' || confidence === 'insufficient'

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${starSize} ${
              i <= stars
                ? stars === 5
                  ? 'fill-green-500 text-green-500'
                  : stars === 4
                  ? 'fill-lime-500 text-lime-500'
                  : stars === 3
                  ? 'fill-amber-500 text-amber-500'
                  : stars === 2
                  ? 'fill-orange-500 text-orange-500'
                  : 'fill-red-500 text-red-500'
                : 'fill-gray-200 text-gray-200'
            } ${isLowConfidence ? 'opacity-60' : ''}`}
          />
        ))}
      </div>
      {showLabel && (
        <span className={`${textSize} font-medium ${label.color} ${isLowConfidence ? 'opacity-70' : ''}`}>
          {label.text}
        </span>
      )}
    </div>
  )
}
