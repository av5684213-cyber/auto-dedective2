'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, Trash2, Plus, X, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useSession } from 'next-auth/react'
import type { SearchFilters } from '@/lib/types'

// ── Alert Manager Component ─────────────────────────────────────────────
//
// Kullanıcı mevcut filtreleri "alarm" olarak kaydeder.
// Yeni ilan geldiğinde bildirim alır.
// Modal olarak açılır — "Alarm Kur" butonundan tetiklenir.

interface AlertManagerProps {
  open: boolean
  onClose: () => void
  currentFilters: SearchFilters
}

interface SavedAlert {
  id: string
  name: string
  filters: string
  notifyEmail: boolean
  notifyPush: boolean
  isActive: boolean
  createdAt: string
  notifiedListingIds: string
}

export function AlertManager({ open, onClose, currentFilters }: AlertManagerProps) {
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<SavedAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [alertName, setAlertName] = useState('')
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyPush, setNotifyPush] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const res = await fetch('/api/alerts')
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts || [])
      }
    } catch {}
    setLoading(false)
  }, [session])

  useEffect(() => {
    if (open) {
      fetchAlerts()
      // Mevcut filtrelerden otomatik isim oluştur
      const parts: string[] = []
      if (currentFilters.make) parts.push(currentFilters.make)
      if (currentFilters.model) parts.push(currentFilters.model)
      if (currentFilters.yearMin) parts.push(`${currentFilters.yearMin}+`)
      if (currentFilters.priceMax) parts.push(`${currentFilters.priceMax.toLocaleString('tr-TR')} TL'ye kadar`)
      if (currentFilters.city) parts.push(currentFilters.city)
      if (currentFilters.fuelType) parts.push(currentFilters.fuelType)
      setAlertName(parts.length > 0 ? parts.join(' ') : 'Tüm İlanlar')
    }
  }, [open, fetchAlerts, currentFilters])

  const handleSave = async () => {
    if (!alertName || alertName.length < 3) {
      setError('İsim en az 3 karakter olmalı')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: alertName,
          filters: currentFilters,
          notifyEmail,
          notifyPush,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Kayıt başarısız')
      } else {
        // Başarılı — listeyi yenile
        await fetchAlerts()
        setAlertName('')
        // Browser notification permission iste
        if (notifyPush && 'Notification' in window) {
          if (Notification.permission === 'default') {
            Notification.requestPermission()
          }
        }
      }
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  const filterSummary = (filtersStr: string): string => {
    try {
      const f = JSON.parse(filtersStr)
      const parts: string[] = []
      if (f.make) parts.push(f.make)
      if (f.model) parts.push(f.model)
      if (f.yearMin) parts.push(`${f.yearMin}+`)
      if (f.yearMax) parts.push(`-${f.yearMax}`)
      if (f.priceMax) parts.push(`${Number(f.priceMax).toLocaleString('tr-TR')} TL`)
      if (f.fuelType) parts.push(f.fuelType)
      if (f.city) parts.push(f.city)
      return parts.length > 0 ? parts.join(' • ') : 'Tüm ilanlar'
    } catch {
      return 'Filtre bilgisi'
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-orange-600" />
            Arama Alarmı Kur
          </DialogTitle>
          <DialogDescription>
            Bu kriterlere uyan yeni ilan geldiğinde otomatik bildirim alacaksınız.
          </DialogDescription>
        </DialogHeader>

        {!session?.user ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Alarm kurmak için giriş yapmalısınız.
            </p>
            <a href="/auth/login">
              <Button className="bg-orange-600 hover:bg-orange-700">
                Giriş Yap
              </Button>
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Yeni alarm kaydet */}
            <div className="space-y-3 p-4 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A]">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Alarm Adı
                </label>
                <Input
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  placeholder="örn: BMW 320i İstanbul 2020+"
                  className="bg-[#0F0F0F]"
                />
              </div>

              {/* Mevcut filtre özeti */}
              <div className="flex flex-wrap gap-1.5">
                {currentFilters.make && <Badge variant="secondary">{currentFilters.make}</Badge>}
                {currentFilters.model && <Badge variant="secondary">{currentFilters.model}</Badge>}
                {currentFilters.yearMin && <Badge variant="secondary">{currentFilters.yearMin}+</Badge>}
                {currentFilters.priceMax && <Badge variant="secondary">≤{currentFilters.priceMax.toLocaleString('tr-TR')} TL</Badge>}
                {currentFilters.fuelType && <Badge variant="secondary">{currentFilters.fuelType}</Badge>}
                {currentFilters.city && <Badge variant="secondary">{currentFilters.city}</Badge>}
              </div>

              {/* Bildirim ayarları */}
              <div className="flex items-center justify-between">
                <span className="text-sm">Email bildirimi</span>
                <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Browser bildirimi</span>
                <Switch checked={notifyPush} onCheckedChange={setNotifyPush} />
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || alertName.length < 3}
                className="w-full bg-orange-600 hover:bg-orange-700 gap-1.5"
              >
                {saving ? 'Kaydediliyor...' : (
                  <>
                    <Plus className="h-4 w-4" />
                    Alarm Kur
                  </>
                )}
              </Button>
            </div>

            {/* Mevcut alarmlar */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Aktif Alarmlar ({alerts.length}/10)
              </h4>

              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Yükleniyor...</p>
              ) : alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Henüz alarm yok. Yukarıdan ilk alarmınızı kurun.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <AnimatePresence>
                    {alerts.map((alert) => (
                      <motion.div
                        key={alert.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <Card className="border-[#2A2A2A] bg-[#1A1A1A]">
                          <CardContent className="p-3 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{alert.name}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {filterSummary(alert.filters)}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                {alert.notifyEmail && (
                                  <Badge variant="outline" className="text-[10px] h-4">📧 Email</Badge>
                                )}
                                {alert.notifyPush && (
                                  <Badge variant="outline" className="text-[10px] h-4">🔔 Push</Badge>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDelete(alert.id)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
