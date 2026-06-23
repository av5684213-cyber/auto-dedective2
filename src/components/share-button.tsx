'use client'

import { useState } from 'react'
import { Share2, Check, Link2 } from 'lucide-react'

// ── Share Button Component ──────────────────────────────────────────────
//
// Uses Web Share API on mobile (native share sheet).
// Falls back to clipboard copy on desktop.
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
  const [copied, setCopied] = useState(false)

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    const shareData = {
      title,
      text: text || `${title} — Otodedektif`,
      url,
    }

    // Try Web Share API (mobile + some desktop browsers)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        // User cancelled or share failed — fall through to clipboard
        if ((err as Error).name === 'AbortError') return
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Last resort: old execCommand
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // give up silently
      }
      document.body.removeChild(textarea)
    }
  }

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const btnSize = size === 'sm' ? 'p-1.5' : 'p-2'

  if (variant === 'button') {
    return (
      <button
        onClick={handleShare}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          copied
            ? 'bg-green-100 text-green-700'
            : 'bg-muted hover:bg-muted/80 text-foreground'
        } ${className}`}
      >
        {copied ? (
          <>
            <Check className={iconSize} />
            Kopyalandı!
          </>
        ) : (
          <>
            <Share2 className={iconSize} />
            Paylaş
          </>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleShare}
      className={`${btnSize} rounded-full backdrop-blur-sm transition-all duration-200 ${
        copied
          ? 'bg-green-500 text-white'
          : 'bg-white/80 text-gray-600 hover:bg-white hover:text-orange-600'
      } ${className}`}
      title={copied ? 'Link kopyalandı!' : 'Paylaş'}
      aria-label="Paylaş"
    >
      {copied ? (
        <Check className={iconSize} />
      ) : (
        <Share2 className={iconSize} />
      )}
    </button>
  )
}
