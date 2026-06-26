'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User, Mail, Bell, Heart, LogOut, Settings, Trash2, CheckCircle2,
  AlertCircle, Smartphone, Send, Mail as MailIcon, Car, Calendar,
  TrendingUp, Plus, ExternalLink, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

// ── Hesabım Sayfası ──────────────────────────────────────────────────────
//
// Kullanıcı sağ üst köşedeki avatar'a tıklayınca açılır.
// İçerik:
//   1. Profil kartı (avatar, isim, email, üyelik tarihi)
//   2. Aktif alarmlar listesi (her alarm için filtre özeti + sil butonu)
//   3. Bildirim kanalları durumu (email, push, telegram)
//   4. Favori ilan sayısı
//   5. Çıkış yap butonu

interface SavedAlert {
  id: string
  name: string
  filters: string
  channels: string
  notifyEmail: boolean
  notifyPush: boolean
  isActive: boolean
  createdAt: string
  lastNotifiedAt?: string | null
}

interface ChannelStatus {
  email?: string
  push?: { subscribed: boolean; count: number }
  telegram?: { chatId: string; username?: string; firstName?: string; connectedAt: string } | null
}

interface FavoritesCount {
  count: number
}

export default function HesabimPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [alerts, setAlerts] = useState<SavedAlert[]>([])
  const [channels, setChannels] = useState<ChannelStatus>({})
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const [alertsRes, favRes] = await Promise.all([
        fetch('/api/alerts'),
        fetch('/api/favorites').catch(() => null),
      ])
      if (alertsRes.ok) {
        const aData = await alertsRes.json()
        setAlerts(aData.alerts || [])
        setChannels(aData.channels || {})
      }
      if (favRes?.ok) {
        const fData = await favRes.json()
        setFavoritesCount(Array.isArray(fData) ? fData.length : (fData.favorites?.length || 0))
      }
    } catch (e) {
      console.error('Hesabım fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/hesabim')
    } else if (status === 'authenticated') {
      fetchAll()
    }
  }, [status, router, fetchAll])

  const handleDeleteAlert = async (id: string) => {
    setDeleting(id)
    try {
      await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      console.error('Silme hatası:', e)
    } finally {
      setDeleting(null)
    }
  }

  const handleSignOut = () => {
    signOut({ redirect: false }).then(() => {
      router.push('/')
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  const userName = (session.user as any).name || session.user.email?.split('@')[0] || 'Kullanıcı'
  const initials = userName.charAt(0).toUpperCase()
  const memberSince = alerts[0]?.createdAt || new Date().toISOString()

  // Filtre özeti
  const filterSummary = (filtersStr: string): string => {
    try {
      const f = JSON.parse(filtersStr)
      const parts: string[] = []
      if (f.make) parts.push(Array.isArray(f.make) ? f.make.join('/') : f.make)
      if (f.model) parts.push(Array.isArray(f.model) ? f.model.join('/') : f.model)
      if (f.yearMin || f.yearMax) parts.push(`${f.yearMin || ''}-${f.yearMax || ''}`.replace(/^-/, '<').replace(/-$/, '+'))
      if (f.priceMax) parts.push(`≤${Number(f.priceMax).toLocaleString('tr-TR')} ₺`)
      if (f.city) parts.push(Array.isArray(f.city) ? f.city.join('/') : f.city)
      if (f.fuelType) parts.push(Array.isArray(f.fuelType) ? f.fuelType.join('/') : f.fuelType)
      if (f.accidentStatus) parts.push(Array.isArray(f.accidentStatus) ? f.accidentStatus.join('/') : f.accidentStatus)
      if (f.dealScoreMin) parts.push(`${f.dealScoreMin}★+`)
      return parts.length > 0 ? parts.join(' • ') : 'Tüm ilanlar'
    } catch {
      return 'Filtre bilgisi'
    }
  }

  const parseAlertChannels = (a: SavedAlert): string[] => {
    if (a.channels) {
      try {
        const parsed = JSON.parse(a.channels)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        const parts = a.channels.split(',').map(s => s.trim()).filter(Boolean)
        if (parts.length > 0) return parts
      }
    }
    const r: string[] = []
    if (a.notifyEmail) r.push('email')
    if (a.notifyPush) r.push('push')
    return r
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2"
          >
            <Car className="h-6 w-6 text-orange-600" />
            <span className="text-base font-bold">
              <span className="text-orange-600">Oto</span>
              <span className="text-amber-500">dedektif</span>
            </span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="text-xs"
          >
            ← Ana Sayfa
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ── Profil Kartı ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-orange-200 dark:border-orange-900/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-orange-600 text-white text-xl font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-foreground truncate">{userName}</h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Mail className="h-3.5 w-3.5" />
                    {session.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    Üyelik: {new Date(memberSince).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900"
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Çıkış
                </Button>
              </div>

              {/* Hızlı istatistikler */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-orange-600">{alerts.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Aktif Alarm</div>
                </div>
                <button
                  onClick={() => router.push('/favorites')}
                  className="text-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="text-2xl font-bold text-orange-600">{favoritesCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">Favori İlan</div>
                </button>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-orange-600">
                    {channels.push?.subscribed ? channels.push.count : 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Push Cihazı</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Bildirim Kanalları ────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-orange-600" />
                Bildirim Kanalları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Email */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600">
                    <MailIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      E-posta
                      {channels.email ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{channels.email || 'Tanımsız'}</div>
                  </div>
                </div>
              </div>

              {/* Push */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-950/30 text-purple-600">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      Tarayıcı Push
                      {channels.push?.subscribed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {channels.push?.subscribed ? `${channels.push.count} cihaz bağlı` : 'Henüz bağlı değil'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Telegram */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-sky-50 dark:bg-sky-950/30 text-sky-600">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      Telegram
                      {channels.telegram ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {channels.telegram
                        ? `@${channels.telegram.username || 'kullanıcı'} · ${new Date(channels.telegram.connectedAt).toLocaleDateString('tr-TR')}`
                        : 'Henüz bağlı değil'}
                    </div>
                  </div>
                </div>
                {!channels.telegram && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/')}
                    className="text-xs"
                  >
                    Bağla
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Aktif Alarmlar ────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-orange-600" />
                  Aktif Alarmlar ({alerts.length}/10)
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/')}
                  className="text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Yeni Alarm
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Henüz alarm kurmamışsınız.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => router.push('/')}
                    className="bg-orange-600 hover:bg-orange-700 gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    İlk Alarımını Kur
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => {
                    const chs = parseAlertChannels(alert)
                    return (
                      <div
                        key={alert.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{alert.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {filterSummary(alert.filters)}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {chs.map(ch => {
                              const icons: Record<string, typeof MailIcon> = {
                                email: MailIcon,
                                push: Smartphone,
                                telegram: Send,
                              }
                              const labels: Record<string, string> = {
                                email: 'E-posta',
                                push: 'Push',
                                telegram: 'Telegram',
                              }
                              const Icon = icons[ch] || Bell
                              return (
                                <Badge key={ch} variant="outline" className="text-[10px] h-5 gap-0.5">
                                  <Icon className="h-2.5 w-2.5" />
                                  {labels[ch] || ch}
                                </Badge>
                              )
                            })}
                            {alert.lastNotifiedAt && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                Son bildirim: {new Date(alert.lastNotifiedAt).toLocaleDateString('tr-TR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteAlert(alert.id)}
                          disabled={deleting === alert.id}
                          className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 shrink-0 transition-colors"
                          title="Alarmı sil"
                        >
                          {deleting === alert.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Hızlı Erişim ──────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/favorites')}
              className="h-auto py-4 flex flex-col items-center gap-2"
            >
              <Heart className="h-5 w-5 text-orange-600" />
              <span className="text-sm">Favorilerim</span>
              <span className="text-xs text-muted-foreground">{favoritesCount} ilan</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="h-auto py-4 flex flex-col items-center gap-2"
            >
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <span className="text-sm">Paneller</span>
              <span className="text-xs text-muted-foreground">İstatistikler</span>
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
