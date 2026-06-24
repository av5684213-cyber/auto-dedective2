'use client'

// Otodedektif - Yönlendirme Ekranı (Client Component)
//
// AutoUncle'dan ilham aldı ama Otodedektif'in kendi kimliğinde:
// - Turuncu tema (Oto dedektif marka rengi)
// - Türkçe metinler
// - 5 saniye geri sayım + "Hemen Yönlendir" + "İlan Detayına Dön" butonları
// - Otomatik redirect (cancel edilebilir)
//
// Layout: AutoUncle gibi ortalanmış, dikey hiyerarşi:
//   1. Otodedektif logosu (üstte)
//   2. "OTODEDEKTİF'TEN AYRILIYORSUNUZ" başlığı
//   3. Açıklama metni (hedef site vurgulu)
//   4. Hedef site kartı (domain + "Harici site" rozeti)
//   5. Geri sayım + butonlar

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Car, ExternalLink, ArrowLeft, AlertTriangle, Shield, Clock } from 'lucide-react'
import { SOURCE_PLATFORMS } from '@/lib/constants'

interface RedirectScreenProps {
  listingId: string
  sourceUrl: string
  sourceName: string
  sourceDomain: string
  make: string
  model: string
  year: number
}

const COUNTDOWN_SECONDS = 3

export function RedirectScreen({
  listingId,
  sourceUrl,
  sourceName,
  sourceDomain,
  make,
  model,
  year,
}: RedirectScreenProps) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [cancelled, setCancelled] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const redirectedRef = useRef(false)

  // Source platform bilgisi (renk, ikon, displayName)
  const platform = SOURCE_PLATFORMS.find(s => s.name === sourceName) || {
    name: sourceName,
    displayName: sourceName,
    baseUrl: sourceUrl,
    color: '#6b7280',
    icon: '🔗',
  }

  // Geri sayım + otomatik yönlendirme
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          if (!redirectedRef.current && !cancelled) {
            redirectedRef.current = true
            window.location.href = sourceUrl
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [sourceUrl, cancelled])

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCancelled(true)
    // İptale basınca kullanıcı beklemeden ilan detayına döner
    router.push(`/ilan/${listingId}`)
  }

  const handleGoBack = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    router.push(`/ilan/${listingId}`)
  }

  const handleRedirectNow = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    redirectedRef.current = true
    window.location.href = sourceUrl
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-lg"
      >

        {/* Otodedektif logosu (en üstte) */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Car className="h-7 w-7 text-orange-600" />
          <span className="text-xl font-bold">
            <span className="text-orange-600">Oto</span>
            <span className="text-amber-500">dedektif</span>
          </span>
        </div>

        {/* Ana kart */}
        <div className="bg-card border rounded-2xl shadow-sm p-8 space-y-6">

          {/* Uyarı ikonu + ana başlık */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              OTODEDEKTİF'TEN AYRILIYORSUNUZ
            </h1>
            <p className="text-sm text-muted-foreground">
              {make} {model} {year} ilanı için sizi harici bir siteye yönlendiriyoruz.
            </p>
          </div>

          {/* Hedef site kartı */}
          <div className="rounded-xl border-2 bg-muted/30 p-5 space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold text-center">
              Yönlendirildiğiniz site
            </p>
            <div className="flex items-center justify-center gap-3">
              <div
                className="flex items-center justify-center w-12 h-12 rounded-lg text-white font-bold text-lg flex-shrink-0"
                style={{ backgroundColor: platform.color }}
              >
                {platform.icon}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base truncate">{platform.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{sourceDomain}</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold uppercase tracking-wide">
                <ExternalLink className="h-3 w-3" />
                Harici Site
              </span>
            </div>
          </div>

          {/* Güvenlik notu */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
            <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              Yönlendirileceğiniz site Otodedektif'in kontrolünde değildir.
              İçerik, gizlilik politikası ve güvenlik uygulamaları farklı olabilir.
            </p>
          </div>

          {/* Geri sayım veya durum */}
          {!cancelled ? (
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  <span className="font-bold text-foreground text-base">{countdown}</span> saniye içinde yönlendiriliyorsunuz...
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-orange-600 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2">
              Yönlendirme iptal edildi.
            </div>
          )}

          {/* Butonlar */}
          <div className="flex flex-col gap-2">
            {!cancelled ? (
              <>
                <button
                  onClick={handleRedirectNow}
                  className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Hemen Yönlendir
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full py-2.5 rounded-lg border hover:bg-muted transition-colors text-sm font-medium"
                >
                  Yönlendirmeyi İptal Et
                </button>
              </>
            ) : (
              <button
                onClick={handleGoBack}
                className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                İlan Detayına Dön
              </button>
            )}
          </div>
        </div>

        {/* Alt link */}
        <div className="text-center mt-6">
          {!cancelled && (
            <button
              onClick={handleGoBack}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              İlan detayına geri dön
            </button>
          )}
        </div>

        {/* Footer notu */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Otodedektif · Tüm İkinci El Araç İlanları Tek Bir Adreste
        </p>
      </motion.div>
    </div>
  )
}
