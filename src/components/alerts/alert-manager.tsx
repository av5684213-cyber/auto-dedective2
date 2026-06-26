'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, Trash2, Plus, X, BellRing, Mail, Smartphone, Send, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
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
import { subscribeToPush, unsubscribeFromPush } from '@/lib/notifications/push-client'

// ── Alert Manager Component ─────────────────────────────────────────────
//
// Kullanıcı mevcut filtreleri "alarm" olarak kaydeder.
// Yeni ilan geldiğinde email + browser push + Telegram bildirimi alır.
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
  channels: string
  notifyEmail: boolean
  notifyPush: boolean
  isActive: boolean
  createdAt: string
}

interface ChannelStatus {
  email?: string
  push?: { subscribed: boolean; count: number }
  telegram?: { chatId: string; username?: string; firstName?: string; connectedAt: string } | null
}

type Channel = 'email' | 'push' | 'telegram'

const CHANNEL_META: Record<Channel, { icon: typeof Mail; label: string; desc: string }> = {
  email: { icon: Mail, label: 'E-posta', desc: 'E-posta ile bilgilendir' },
  push: { icon: Smartphone, label: 'Tarayıcı Push', desc: 'Masaüstü/mobil bildirim' },
  telegram: { icon: Send, label: 'Telegram', desc: 'Bot üzerinden mesaj' },
}

export function AlertManager({ open, onClose, currentFilters }: AlertManagerProps) {
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<SavedAlert[]>([])
  const [channels, setChannels] = useState<Channel[]>(['email'])
  const [channelStatus, setChannelStatus] = useState<ChannelStatus>({})
  const [loading, setLoading] = useState(false)
  const [alertName, setAlertName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pushConnecting, setPushConnecting] = useState(false)
  const [telegramLink, setTelegramLink] = useState<string | null>(null)
  const [testingChannel, setTestingChannel] = useState<Channel | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchAlerts = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const res = await fetch('/api/alerts')
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts || [])
        setChannelStatus(data.channels || {})
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
      // Default kanallar — sadece uygun olanları seç
      const defaultChs: Channel[] = []
      if (channelStatus.email) defaultChs.push('email')
      defaultChs.push('push') // push her zaman dene
      if (channelStatus.telegram) defaultChs.push('telegram')
      if (defaultChs.length === 0) defaultChs.push('email')
      setChannels(defaultChs)
      // Telegram link cache
      if (!channelStatus.telegram) {
        fetch('/api/telegram/connect').then(r => r.json()).then(d => {
          if (d.link) setTelegramLink(d.link)
        }).catch(() => {})
      }
    }
  }, [open, fetchAlerts, currentFilters, channelStatus.telegram, channelStatus.email])

  const toggleChannel = (ch: Channel) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  const handleEnablePush = async () => {
    setPushConnecting(true)
    setError(null)
    try {
      const r = await subscribeToPush()
      if (r.ok) {
        showToast('✅ Push bildirimi aktif edildi')
        await fetchAlerts()
      } else {
        setError(r.error || 'Push aktivasyonu başarısız')
      }
    } finally {
      setPushConnecting(false)
    }
  }

  const handleConnectTelegram = async () => {
    if (telegramLink) {
      window.open(telegramLink, '_blank')
      return
    }
    try {
      const res = await fetch('/api/telegram/connect')
      const data = await res.json()
      if (data.link) {
        setTelegramLink(data.link)
        window.open(data.link, '_blank')
      } else if (data.alreadyConnected) {
        showToast('Telegram zaten bağlı')
        await fetchAlerts()
      }
    } catch {
      setError('Telegram bağlantısı alınamadı')
    }
  }

  const handleTestChannel = async (ch: Channel) => {
    setTestingChannel(ch)
    try {
      const endpoint = ch === 'push' ? '/api/push/test' : ch === 'telegram' ? '/api/telegram/test' : null
      if (!endpoint) {
        showToast('📧 Email testi için yeni ilan gelmesini bekleyin')
        return
      }
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        showToast(`✅ ${ch === 'push' ? 'Push' : 'Telegram'} test mesajı gönderildi`)
      } else {
        showToast(`❌ ${data.error || 'Test başarısız'}`)
      }
    } catch {
      showToast('Test sırasında hata')
    } finally {
      setTestingChannel(null)
    }
  }

  const handleSave = async () => {
    if (!alertName || alertName.length < 3) {
      setError('İsim en az 3 karakter olmalı')
      return
    }
    if (channels.length === 0) {
      setError('En az 1 bildirim kanalı seçin')
      return
    }
    // Push seçili ama izin/kayıt yoksa uyar
    if (channels.includes('push') && !channelStatus.push?.subscribed) {
      const proceed = confirm('Push bildirimi seçtiniz ama tarayıcı kaydınız yok. Şimdi etkinleştirmek ister misiniz? (İptal ederseniz sadece email/telegram ile bildirim gelecek)')
      if (proceed) {
        await handleEnablePush()
      } else {
        // push'u kaldır
        setChannels(prev => prev.filter(c => c !== 'push'))
        return
      }
    }
    if (channels.includes('telegram') && !channelStatus.telegram) {
      setError('Telegram bağlı değil. Önce "Bağla" butonuna tıklayın.')
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
          channels,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Kayıt başarısız')
      } else {
        showToast('✅ Alarm kuruldu')
        await fetchAlerts()
        setAlertName('')
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
      showToast('Alarm silindi')
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

  const parseAlertChannels = (a: SavedAlert): Channel[] => {
    if (a.channels) {
      // JSON array dene
      try {
        const parsed = JSON.parse(a.channels)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        // comma-separated dene
        const parts = a.channels.split(',').map(s => s.trim()).filter(Boolean)
        if (parts.length > 0) return parts as Channel[]
      }
    }
    // Backward compat
    const r: Channel[] = []
    if (a.notifyEmail) r.push('email')
    if (a.notifyPush) r.push('push')
    return r
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
            Bu kriterlere uyan yeni ilan geldiğinde email, push veya Telegram ile bildirim alacaksınız.
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

              {/* Bildirim kanalları */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Bildirim Kanalları</label>
                {(['email', 'push', 'telegram'] as Channel[]).map((ch) => {
                  const meta = CHANNEL_META[ch]
                  const Icon = meta.icon
                  const isActive = channels.includes(ch)
                  const isConnected = ch === 'email' ? !!channelStatus.email
                    : ch === 'push' ? !!channelStatus.push?.subscribed
                    : !!channelStatus.telegram

                  return (
                    <div
                      key={ch}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isActive ? 'border-orange-500/50 bg-orange-500/5' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
                      }`}
                      onClick={() => toggleChannel(ch)}
                    >
                      <div className={`p-1.5 rounded-md ${isActive ? 'bg-orange-500/15 text-orange-500' : 'bg-[#0F0F0F] text-muted-foreground'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{meta.label}</span>
                          {isConnected ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {ch === 'email' ? channelStatus.email
                            : ch === 'push' ? (channelStatus.push?.subscribed ? `${channelStatus.push.count} cihaz bağlı` : 'Henüz bağlı değil')
                            : (channelStatus.telegram ? `@${channelStatus.telegram.username || 'kullanıcı'}` : 'Henüz bağlı değil')}
                        </p>
                      </div>
                      <Switch checked={isActive} onCheckedChange={() => toggleChannel(ch)} onClick={(e) => e.stopPropagation()} />
                    </div>
                  )
                })}

                {/* Push etkinleştirme butonu */}
                {channels.includes('push') && !channelStatus.push?.subscribed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnablePush}
                    disabled={pushConnecting}
                    className="w-full gap-1.5 text-xs"
                  >
                    {pushConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                    Push Bildirimini Etkinleştir
                  </Button>
                )}

                {/* Telegram bağla butonu */}
                {channels.includes('telegram') && !channelStatus.telegram && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConnectTelegram}
                    className="w-full gap-1.5 text-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Telegram'ı Bağla
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}

                {/* Test butonları (sadece bağlı kanallar için) */}
                <div className="flex gap-2 pt-1">
                  {channelStatus.push?.subscribed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestChannel('push')}
                      disabled={testingChannel === 'push'}
                      className="flex-1 text-xs h-7"
                    >
                      {testingChannel === 'push' ? <Loader2 className="h-3 w-3 animate-spin" /> : '🔔 Push Test'}
                    </Button>
                  )}
                  {channelStatus.telegram && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestChannel('telegram')}
                      disabled={testingChannel === 'telegram'}
                      className="flex-1 text-xs h-7"
                    >
                      {testingChannel === 'telegram' ? <Loader2 className="h-3 w-3 animate-spin" /> : '✈️ TG Test'}
                    </Button>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || alertName.length < 3 || channels.length === 0}
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
                    {alerts.map((alert) => {
                      const chs = parseAlertChannels(alert)
                      return (
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
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  {chs.map(ch => {
                                    const meta = CHANNEL_META[ch]
                                    const Icon = meta.icon
                                    return (
                                      <Badge key={ch} variant="outline" className="text-[10px] h-4 gap-0.5">
                                        <Icon className="h-2.5 w-2.5" />
                                        {meta.label}
                                      </Badge>
                                    )
                                  })}
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
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0F0F0F] border border-[#2A2A2A] text-white text-xs px-3 py-2 rounded-lg shadow-xl z-10">
            {toast}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
