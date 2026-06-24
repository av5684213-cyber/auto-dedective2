'use client'

import { useMemo } from 'react'

// ── Listing Description Summary ─────────────────────────────────────────
//
// Uzun açıklama metnini 3 maddeye özetler.
// AI yerine rule-based: anahtar bilgileri (km, hasar, bakım, garanti, renk, vb.) çıkarır.

interface DescriptionSummaryProps {
  description?: string | null
  listing?: {
    make?: string | null
    model?: string | null
    year?: number
    price?: number
    mileageKm?: number | null
    fuelType?: string | null
    transmission?: string | null
    color?: string | null
    city?: string | null
    sellerType?: string | null
  } | null
}

interface SummaryItem {
  icon: string
  text: string
}

function extractSummaryPoints(description: string, listing: any): SummaryItem[] {
  const points: SummaryItem[] = []
  const desc = description.toLowerCase()

  // 1. Hasar durumu
  if (desc.includes('hasarsız') || desc.includes('hasarsiz') || desc.includes('hasar kaydı bulunmuyor') || desc.includes('hasar kaydi bulunmuyor')) {
    points.push({ icon: '✅', text: 'Hasarsız, hasar kaydı yok' })
  } else if (desc.includes('hasarlı') || desc.includes('hasarli') || desc.includes('tramer') || desc.includes('değişen')) {
    points.push({ icon: '⚠️', text: 'Hasar/tramer kaydı mevcut' })
  }

  // 2. Bakım durumu
  if (desc.includes('bakımlı') || desc.includes('bakimli') || desc.includes('bakımı yapılmış') || desc.includes('bakimi yapilmis') || desc.includes('servis bakımlı')) {
    points.push({ icon: '🔧', text: 'Düzenli bakımlı, servis kaydı mevcut' })
  }

  // 3. Garanti
  if (desc.includes('garanti') || desc.includes('bgv')) {
    points.push({ icon: '🛡️', text: 'Garantili' })
  }

  // 4. Boya/durum
  if (desc.includes('boyasız') || desc.includes('boyasiz') || desc.includes('orijinal boya')) {
    points.push({ icon: '🎨', text: 'Orijinal boya, boyasız' })
  } else if (desc.includes('tek el')) {
    points.push({ icon: '👤', text: 'Tek el kullanılmış' })
  }

  // 5. Düşük KM
  if (listing?.mileageKm && listing.mileageKm < 50000) {
    points.push({ icon: '📏', text: `Düşük kilometre: ${listing.mileageKm.toLocaleString('tr-TR')} km` })
  }

  // 6. Takas
  if (desc.includes('takas') && !desc.includes('takassız')) {
    points.push({ icon: '🔄', text: 'Takas kabul edilir' })
  } else if (desc.includes('takassız') || desc.includes('takassız')) {
    points.push({ icon: '🚫', text: 'Takassız' })
  }

  // 7. Kredi
  if (desc.includes('kredi') || desc.includes('banka')) {
    points.push({ icon: '💳', text: 'Krediye uygun' })
  }

  // 8. Sahibinden
  if (listing?.sellerType === 'Sahibinden' || desc.includes('sahibinden')) {
    points.push({ icon: '🏠', text: 'Sahibinden satılık' })
  }

  // Eğer yeterli madde çıkmadıysa, listing bilgilerinden tamamla
  if (points.length < 3 && listing) {
    if (listing.fuelType && listing.transmission) {
      const alreadyHas = points.some(p => p.text.includes(listing.fuelType))
      if (!alreadyHas) {
        points.push({ icon: '⛽', text: `${listing.fuelType} • ${listing.transmission}` })
      }
    }
    if (listing.city) {
      points.push({ icon: '📍', text: `Konum: ${listing.city}` })
    }
    if (listing.color) {
      points.push({ icon: '🎨', text: `Renk: ${listing.color}` })
    }
  }

  // En fazla 3 madde
  return points.slice(0, 3)
}

export function DescriptionSummary({ description, listing }: DescriptionSummaryProps) {
  const summaryPoints = useMemo(() => {
    if (!description && !listing) return []
    return extractSummaryPoints(description || '', listing)
  }, [description, listing])

  if (summaryPoints.length === 0) return null

  return (
    <div className="rounded-lg bg-orange-50/50 border border-orange-200/50 p-3 space-y-2">
      <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wide flex items-center gap-1.5">
        📋 İlan Özeti
      </h4>
      <div className="space-y-1.5">
        {summaryPoints.map((point, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-base leading-tight">{point.icon}</span>
            <span className="text-foreground leading-snug">{point.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
