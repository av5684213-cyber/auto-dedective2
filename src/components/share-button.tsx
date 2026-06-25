'use client'

import { Share2 } from 'lucide-react'

// ── Share Button Component ──────────────────────────────────────────────
//
// Uses Web Share API (native share sheet — mobil + modern masaüstü).
//
// Usage:
//   <ShareButton url="https://..." title="BMW 320i 2020 - 1.250.000 TL" />
//   <ShareButton url="https://..." title="..." variant="icon" />  // just icon

interface ShareButtonProps {
  url: string
  title?: string
  text?: string
  variant?: 'button' | 'icon'
  className?: string
  size?: 'sm' | 'md'
}

export function ShareButton({
  url,
  title = 'Otodedektif ilan',
  text,
  variant = 'icon',
  className = '',
  size = 'sm',
}: ShareButtonProps) {
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    const shareData = {
      title,
      text: text || `${title} — Otodedektif`,
      url,
    }

    // Native share sheet (mobil + modern masaüstü tarayıcılar)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        // User cancelled — sessizce yoksay
        if ((err as Error).name === 'AbortError') return
      }
    }
  }

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const btnSize = size === 'sm' ? 'p-1.5' : 'p-2'

  if (variant === 'button') {
    return (
      <button
        onClick={handleShare}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer bg-muted hover:bg-muted/80 text-foreground ${className}`}
      >
        <Share2 className={iconSize} />
        Paylaş
      </button>
    )
  }

  return (
    <button
      onClick={handleShare}
      className={`${btnSize} rounded-full backdrop-blur-sm transition-all duration-200 cursor-pointer bg-white/80 text-gray-600 hover:bg-white hover:text-orange-600 ${className}`}
      title="Paylaş"
      aria-label="Paylaş"
    >
      <Share2 className={iconSize} />
    </button>
  )
}
