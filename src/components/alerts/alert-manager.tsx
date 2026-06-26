'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BellRing, Trash2, Plus, Mail, Smartphone, Send, CheckCircle2, AlertCircle, ExternalLink, Loader2, ChevronDown, X, Star, Filter } from 'lucide-react'
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
import { subscribeToPush } from '@/lib/notifications/push-client'
import { FILTER_OPTIONS } from '@/lib/notifications/filter-options'

// ── Alert Manager v3 — Detaylı Filtre Paneli ────────────────────────────
//
// 16+ filtre desteği:
//   Marka (cascade), Model (cascade), Trim, Yıl aralığı, Fiyat aralığı,
//   KM aralığı, Yakıt, Vites, Kasa tipi, Renk (+ hariç tutma),
//   Şehir, İlçe, Satıcı tipi, Kazalı durumu, DealScore min, Fırsat etiketi
//
// Marka seçilince otomatik olarak o markanın modelleri /api/vehicles/models'den çekilir.
// Şehir seçilince ilçeler /api/vehicles/districts'den çekilir.

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

// Çoklu seçim chip bileşeni
function MultiSelectChips({
  options,
  selected,
  onChange,
  placeholder = 'Seçiniz...',
  maxShow = 6,
}: {
  options: { value: string; label?: string; count?: number }[] | string[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  maxShow?: number
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalizedOptions = useMemo(() => {
    return options.map(o => {
      if (typeof o === 'string') return { value: o, label: o }
      return { value: o.value, label: o.label || o.value, count: o.count }
    })
  }, [options])

  const filtered = useMemo(() => {
    if (!query) return normalizedOptions
    return normalizedOptions.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
  }, [normalizedOptions, query])

  const toggle = (v: string) => {
    if (selected.includes(v)) {
      onChange(selected.filter(s => s !== v))
    } else {
      onChange([...selected, v])
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 bg-[#0F0F0F] border border-[#2A2A2A] rounded-md text-left flex items-center justify-between text-sm hover:border-[#3A3A3A]"
      >
        <span className={selected.length === 0 ? 'text-gray-500' : 'text-white'}>
          {selected.length === 0 ? placeholder : `${selected.length} seçili`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.slice(0, maxShow).map(s => (
            <Badge key={s} variant="secondary" className="text-[10px] h-5 gap-0.5">
              {s}
              <button onClick={() => toggle(s)} className="ml-1 hover:text-red-400">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {selected.length > maxShow && (
            <Badge variant="outline" className="text-[10px] h-5">+{selected.length - maxShow}</Badge>
          )}
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-md shadow-xl max-h-60 overflow-y-auto">
            <div className="p-2 border-b border-[#2A2A2A]">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ara..."
                className="w-full px-2 py-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded text-xs text-white"
              />
            </div>
            {filtered.length === 0 && (
              <div className="p-3 text-center text-xs text-gray-500">Sonuç yok</div>
            )}
            {filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#1A1A1A] flex items-center justify-between ${
                  selected.includes(o.value) ? 'text-orange-400' : 'text-white'
                }`}
              >
                <span>{o.label}</span>
                <span className="flex items-center gap-2">
                  {o.count !== undefined && (
                    <span className="text-[10px] text-gray-500">{o.count}</span>
                  )}
                  {selected.includes(o.value) && <CheckCircle2 className="h-3 w-3" />}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Sayısal aralık input çifti
function RangeInput({
  minVal, maxVal, onMinChange, onMaxChange, placeholder = { min: 'Min', max: 'Max' }, suffix
}: {
  minVal: string
  maxVal: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
  placeholder?: { min: string; max: string }
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={minVal}
        onChange={e => onMinChange(e.target.value)}
        placeholder={placeholder.min}
        className="w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-md text-xs text-white placeholder-gray-600"
      />
      <span className="text-gray-500 text-xs">—</span>
      <input
        type="number"
        value={maxVal}
        onChange={e => onMaxChange(e.target.value)}
        placeholder={placeholder.max}
        className="w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-[#2A2A2A] rounded-md text-xs text-white placeholder-gray-600"
      />
      {suffix && <span className="text-gray-500 text-xs whitespace-nowrap">{suffix}</span>}
    </div>
  )
}

// Yıldız seçici
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === n ? 0 : n)}
          className="p-0.5"
        >
          <Star
            className={`h-4 w-4 transition-colors ${
              (hover || value) >= n
                ? 'fill-orange-500 text-orange-500'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-xs text-orange-400">
          {value}+ yıldız
        </span>
      )}
    </div>
  )
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
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Cascade data
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([])
  const [models, setModels] = useState<{ model: string; count: number }[]>([])
  const [districts, setDistricts] = useState<{ district: string; count: number }[]>([])
  const [trims, setTrims] = useState<{ trim: string; count: number }[]>([])
  const [bodyTypes, setBodyTypes] = useState<{ bodyType: string; count: number }[]>([])
  const [transmissions, setTransmissions] = useState<{ transmission: string; count: number }[]>([])
  const [fuelTypes, setFuelTypes] = useState<{ fuelType: string; count: number }[]>([])

  // Filtre state (kullanıcı girişi)
  const [filterState, setFilterState] = useState<{
    make: string[]
    model: string[]
    trim: string
    yearMin: string
    yearMax: string
    priceMin: string
    priceMax: string
    mileageMin: string
    mileageMax: string
    fuelType: string[]
    transmission: string[]
    bodyType: string[]
    color: string[]
    colorExclude: string[]
    city: string[]
    district: string[]
    sellerType: string[]
    accidentStatus: string[]
    dealScoreMin: number
    dealTag: string[]
  }>({
    make: [],
    model: [],
    trim: '',
    yearMin: '',
    yearMax: '',
    priceMin: '',
    priceMax: '',
    mileageMin: '',
    mileageMax: '',
    fuelType: [],
    transmission: [],
    bodyType: [],
    color: [],
    colorExclude: [],
    city: [],
    district: [],
    sellerType: [],
    accidentStatus: [],
    dealScoreMin: 0,
    dealTag: [],
  })

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

  const fetchMakes = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles/makes')
      if (res.ok) {
        const data = await res.json()
        setMakes(data.makes || [])
      }
    } catch {}
  }, [])

  const fetchModels = useCallback(async (make: string) => {
    if (!make) {
      setModels([])
      return
    }
    try {
      const res = await fetch(`/api/vehicles/models?make=${encodeURIComponent(make)}`)
      if (res.ok) {
        const data = await res.json()
        setModels(data.models || [])
      }
    } catch {}
  }, [])

  const fetchDistricts = useCallback(async (city: string) => {
    if (!city) {
      setDistricts([])
      return
    }
    try {
      const res = await fetch(`/api/vehicles/districts?city=${encodeURIComponent(city)}`)
      if (res.ok) {
        const data = await res.json()
        setDistricts(data.districts || [])
      }
    } catch {}
  }, [])

  const fetchTrims = useCallback(async (make: string, model: string) => {
    if (!make || !model) {
      setTrims([])
      return
    }
    try {
      const res = await fetch(`/api/vehicles/trims?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`)
      if (res.ok) {
        const data = await res.json()
        setTrims(data.trims || [])
      }
    } catch {}
  }, [])

  const fetchBodyTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles/body-types')
      if (res.ok) {
        const data = await res.json()
        setBodyTypes(data.bodyTypes || [])
      }
    } catch {}
  }, [])

  const fetchTransmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles/transmissions')
      if (res.ok) {
        const data = await res.json()
        setTransmissions(data.transmissions || [])
      }
    } catch {}
  }, [])

  const fetchFuelTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles/fuel-types')
      if (res.ok) {
        const data = await res.json()
        setFuelTypes(data.fuelTypes || [])
      }
    } catch {}
  }, [])

  // Modal açılınca ilk yükleme
  useEffect(() => {
    if (open) {
      fetchAlerts()
      fetchMakes()
      fetchBodyTypes()
      fetchTransmissions()
      fetchFuelTypes()
      // Mevcut filtrelerden state'i başlat
      setFilterState(prev => ({
        ...prev,
        make: currentFilters.make ? [currentFilters.make] : [],
        model: currentFilters.model ? [currentFilters.model] : [],
        yearMin: currentFilters.yearMin ? String(currentFilters.yearMin) : '',
        yearMax: currentFilters.yearMax ? String(currentFilters.yearMax) : '',
        priceMin: currentFilters.priceMin ? String(currentFilters.priceMin) : '',
        priceMax: currentFilters.priceMax ? String(currentFilters.priceMax) : '',
        mileageMax: currentFilters.mileageMax ? String(currentFilters.mileageMax) : '',
        fuelType: currentFilters.fuelType ? [currentFilters.fuelType] : [],
        transmission: currentFilters.transmission ? [currentFilters.transmission] : [],
        bodyType: currentFilters.bodyType ? [currentFilters.bodyType] : [],
        city: currentFilters.city ? [currentFilters.city] : [],
        sellerType: currentFilters.sellerType ? [currentFilters.sellerType] : [],
        dealTag: currentFilters.dealTag ? (Array.isArray(currentFilters.dealTag) ? currentFilters.dealTag : [currentFilters.dealTag]) : [],
      }))
      // Mevcut filtrelerden otomatik isim oluştur
      const parts: string[] = []
      if (currentFilters.make) parts.push(currentFilters.make)
      if (currentFilters.model) parts.push(currentFilters.model)
      if (currentFilters.yearMin) parts.push(`${currentFilters.yearMin}+`)
      if (currentFilters.priceMax) parts.push(`${currentFilters.priceMax.toLocaleString('tr-TR')} TL'ye kadar`)
      if (currentFilters.city) parts.push(currentFilters.city)
      if (currentFilters.fuelType) parts.push(currentFilters.fuelType)
      setAlertName(parts.length > 0 ? parts.join(' ') : 'Tüm İlanlar')

      // Default kanallar
      const defaultChs: Channel[] = []
      if (channelStatus.email) defaultChs.push('email')
      defaultChs.push('push')
      if (channelStatus.telegram) defaultChs.push('telegram')
      if (defaultChs.length === 0) defaultChs.push('email')
      setChannels(defaultChs)

      if (!channelStatus.telegram) {
        fetch('/api/telegram/connect').then(r => r.json()).then(d => {
          if (d.link) setTelegramLink(d.link)
        }).catch(() => {})
      }
    }
  }, [open, fetchAlerts, fetchMakes, fetchBodyTypes, fetchTransmissions, fetchFuelTypes, currentFilters, channelStatus.telegram, channelStatus.email])

  // Marka değişince model listesini yenile
  useEffect(() => {
    if (filterState.make.length === 1) {
      fetchModels(filterState.make[0])
    } else {
      setModels([])
      // Çoklu marka seçilince model seçimini temizle
      if (filterState.make.length > 1) {
        setFilterState(prev => ({ ...prev, model: [] }))
      }
    }
  }, [filterState.make, fetchModels])

  // Marka + Model seçilince trim listesini yenile (cascade)
  useEffect(() => {
    if (filterState.make.length === 1 && filterState.model.length === 1) {
      fetchTrims(filterState.make[0], filterState.model[0])
    } else {
      setTrims([])
      // Çoklu seçim olunca trim seçimini temizle
      if (filterState.make.length > 1 || filterState.model.length > 1 || filterState.model.length === 0) {
        if (filterState.trim) {
          setFilterState(prev => ({ ...prev, trim: '' }))
        }
      }
    }
  }, [filterState.make, filterState.model, fetchTrims])

  // Şehir değişince ilçe listesini yenile
  useEffect(() => {
    if (filterState.city.length === 1) {
      fetchDistricts(filterState.city[0])
    } else {
      setDistricts([])
      if (filterState.city.length > 1) {
        setFilterState(prev => ({ ...prev, district: [] }))
      }
    }
  }, [filterState.city, fetchDistricts])

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

  // Filtre state'i API'ye gönderilecek formata çevir
  const buildFiltersPayload = () => {
    const f: any = {}
    if (filterState.make.length) f.make = filterState.make.length === 1 ? filterState.make[0] : filterState.make
    if (filterState.model.length) f.model = filterState.model.length === 1 ? filterState.model[0] : filterState.model
    if (filterState.trim.trim()) f.trim = filterState.trim.trim()
    if (filterState.yearMin) f.yearMin = Number(filterState.yearMin)
    if (filterState.yearMax) f.yearMax = Number(filterState.yearMax)
    if (filterState.priceMin) f.priceMin = Number(filterState.priceMin)
    if (filterState.priceMax) f.priceMax = Number(filterState.priceMax)
    if (filterState.mileageMin) f.mileageMin = Number(filterState.mileageMin)
    if (filterState.mileageMax) f.mileageMax = Number(filterState.mileageMax)
    if (filterState.fuelType.length) f.fuelType = filterState.fuelType.length === 1 ? filterState.fuelType[0] : filterState.fuelType
    if (filterState.transmission.length) f.transmission = filterState.transmission.length === 1 ? filterState.transmission[0] : filterState.transmission
    if (filterState.bodyType.length) f.bodyType = filterState.bodyType.length === 1 ? filterState.bodyType[0] : filterState.bodyType
    if (filterState.color.length) f.color = filterState.color.length === 1 ? filterState.color[0] : filterState.color
    if (filterState.colorExclude.length) f.colorExclude = filterState.colorExclude.length === 1 ? filterState.colorExclude[0] : filterState.colorExclude
    if (filterState.city.length) f.city = filterState.city.length === 1 ? filterState.city[0] : filterState.city
    if (filterState.district.length) f.district = filterState.district.length === 1 ? filterState.district[0] : filterState.district
    if (filterState.sellerType.length) f.sellerType = filterState.sellerType.length === 1 ? filterState.sellerType[0] : filterState.sellerType
    if (filterState.accidentStatus.length) f.accidentStatus = filterState.accidentStatus.length === 1 ? filterState.accidentStatus[0] : filterState.accidentStatus
    if (filterState.dealScoreMin > 0) f.dealScoreMin = filterState.dealScoreMin
    if (filterState.dealTag.length) f.dealTag = filterState.dealTag.length === 1 ? filterState.dealTag[0] : filterState.dealTag
    return f
  }

  // Kaç filtre seçili?
  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filterState.make.length) n++
    if (filterState.model.length) n++
    if (filterState.trim) n++
    if (filterState.yearMin || filterState.yearMax) n++
    if (filterState.priceMin || filterState.priceMax) n++
    if (filterState.mileageMin || filterState.mileageMax) n++
    if (filterState.fuelType.length) n++
    if (filterState.transmission.length) n++
    if (filterState.bodyType.length) n++
    if (filterState.color.length || filterState.colorExclude.length) n++
    if (filterState.city.length) n++
    if (filterState.district.length) n++
    if (filterState.sellerType.length) n++
    if (filterState.accidentStatus.length) n++
    if (filterState.dealScoreMin > 0) n++
    if (filterState.dealTag.length) n++
    return n
  }, [filterState])

  const handleSave = async () => {
    if (!alertName || alertName.length < 3) {
      setError('İsim en az 3 karakter olmalı')
      return
    }
    if (channels.length === 0) {
      setError('En az 1 bildirim kanalı seçin')
      return
    }
    if (channels.includes('push') && !channelStatus.push?.subscribed) {
      const proceed = confirm('Push bildirimi seçtiniz ama tarayıcı kaydınız yok. Şimdi etkinleştirmek ister misiniz? (İptal ederseniz sadece email/telegram ile bildirim gelecek)')
      if (proceed) {
        await handleEnablePush()
      } else {
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
      const filtersPayload = buildFiltersPayload()

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: alertName,
          filters: filtersPayload,
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
      if (f.make) parts.push(Array.isArray(f.make) ? f.make.join('/') : f.make)
      if (f.model) parts.push(Array.isArray(f.model) ? f.model.join('/') : f.model)
      if (f.trim) parts.push(f.trim)
      if (f.yearMin || f.yearMax) {
        parts.push(`${f.yearMin || ''}-${f.yearMax || ''}`.replace(/^-/, '<').replace(/-$/, '+'))
      }
      if (f.priceMax) parts.push(`${Number(f.priceMax).toLocaleString('tr-TR')} TL`)
      if (f.mileageMax) parts.push(`${f.mileageMax} km`)
      if (f.fuelType) parts.push(Array.isArray(f.fuelType) ? f.fuelType.join('/') : f.fuelType)
      if (f.transmission) parts.push(Array.isArray(f.transmission) ? f.transmission.join('/') : f.transmission)
      if (f.color) parts.push(Array.isArray(f.color) ? f.color.join('/') : f.color)
      if (f.city) parts.push(Array.isArray(f.city) ? f.city.join('/') : f.city)
      if (f.district) parts.push(Array.isArray(f.district) ? f.district.join('/') : f.district)
      if (f.accidentStatus) parts.push(Array.isArray(f.accidentStatus) ? f.accidentStatus.join('/') : f.accidentStatus)
      if (f.dealScoreMin) parts.push(`${f.dealScoreMin}★+`)
      return parts.length > 0 ? parts.join(' • ') : 'Tüm ilanlar'
    } catch {
      return 'Filtre bilgisi'
    }
  }

  const parseAlertChannels = (a: SavedAlert): Channel[] => {
    if (a.channels) {
      try {
        const parsed = JSON.parse(a.channels)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        const parts = a.channels.split(',').map(s => s.trim()).filter(Boolean)
        if (parts.length > 0) return parts as Channel[]
      }
    }
    const r: Channel[] = []
    if (a.notifyEmail) r.push('email')
    if (a.notifyPush) r.push('push')
    return r
  }

  // Renk seçenekleri: DB'den yüklenenleri + FILTER_OPTIONS'ı birleştir
  const colorOptions = useMemo(() => {
    return FILTER_OPTIONS.renk.map(c => ({ value: c, label: c }))
  }, [])

  const updateFilter = <K extends keyof typeof filterState>(key: K, value: (typeof filterState)[K]) => {
    setFilterState(prev => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-orange-600" />
            Arama Alarmı Kur
          </DialogTitle>
          <DialogDescription>
            Detaylı filtreler tanımla — istediğin marka, model, renk, kazalı durumu ve daha fazlası. Eşleşen yeni ilan gelince bildirim alırsın.
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
                  placeholder="örn: BMW 320i İstanbul Kazasız 2020+"
                  className="bg-[#0F0F0F]"
                />
              </div>

              {/* ── FİLTRELER ─────────────────────────────────────────── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    Filtreler {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4">{activeFilterCount}</Badge>
                    )}
                  </label>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-orange-500 hover:text-orange-400"
                  >
                    {showAdvanced ? '↑ Gizle' : '↓ Tüm filtreler'}
                  </button>
                </div>

                {/* Marka — kendi kutusu (her zaman görünür) */}
                <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                  <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-orange-500" />
                    Marka
                  </label>
                  <MultiSelectChips
                    options={makes.map(m => ({ value: m.make, label: m.make, count: m.count }))}
                    selected={filterState.make}
                    onChange={v => updateFilter('make', v)}
                    placeholder="Marka seç (çoklu)"
                  />
                </div>

                {/* Model — kendi kutusu (cascade) */}
                <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                  <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-orange-500" />
                    Model {filterState.make.length === 1 ? `(${models.length})` : filterState.make.length > 1 ? '(tek marka seç)' : ''}
                  </label>
                  <MultiSelectChips
                    options={filterState.make.length === 1 ? models.map(m => ({ value: m.model, label: m.model, count: m.count })) : []}
                    selected={filterState.model}
                    onChange={v => updateFilter('model', v)}
                    placeholder={filterState.make.length === 1 ? 'Model seç (çoklu)' : 'Önce tek marka seç'}
                  />
                </div>

                {/* Yıl Aralığı — kendi kutusu (her zaman görünür) */}
                <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                  <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-orange-500" />
                    Yıl Aralığı
                  </label>
                  <RangeInput
                    minVal={filterState.yearMin}
                    maxVal={filterState.yearMax}
                    onMinChange={v => updateFilter('yearMin', v)}
                    onMaxChange={v => updateFilter('yearMax', v)}
                    placeholder={{ min: 'Min yıl', max: 'Max yıl' }}
                  />
                </div>

                {/* Fiyat Aralığı — kendi kutusu (her zaman görünür) */}
                <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                  <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-orange-500" />
                    Fiyat Aralığı (₺)
                  </label>
                  <RangeInput
                    minVal={filterState.priceMin}
                    maxVal={filterState.priceMax}
                    onMinChange={v => updateFilter('priceMin', v)}
                    onMaxChange={v => updateFilter('priceMax', v)}
                    placeholder={{ min: 'Min ₺', max: 'Max ₺' }}
                  />
                </div>

                {/* ── GELİŞMİŞ FİLTRELER ─────────────────────────────── */}
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {/* KM Aralığı — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          KM Aralığı
                        </label>
                        <RangeInput
                          minVal={filterState.mileageMin}
                          maxVal={filterState.mileageMax}
                          onMinChange={v => updateFilter('mileageMin', v)}
                          onMaxChange={v => updateFilter('mileageMax', v)}
                          placeholder={{ min: 'Min km', max: 'Max km' }}
                          suffix="km"
                        />
                      </div>

                      {/* Yakıt Tipi — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Yakıt Tipi
                        </label>
                        <MultiSelectChips
                          options={[
                            ...fuelTypes.map(f => ({ value: f.fuelType, label: f.fuelType, count: f.count })),
                            ...FILTER_OPTIONS.yakit
                              .filter(y => !fuelTypes.some(f => f.fuelType === y))
                              .map(v => ({ value: v, label: v })),
                          ]}
                          selected={filterState.fuelType}
                          onChange={v => updateFilter('fuelType', v)}
                          placeholder="Yakıt tipi seç (çoklu)"
                        />
                      </div>

                      {/* Vites Tipi — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Vites Tipi
                        </label>
                        <MultiSelectChips
                          options={[
                            ...transmissions.map(t => ({ value: t.transmission, label: t.transmission, count: t.count })),
                            ...FILTER_OPTIONS.vites
                              .filter(y => !transmissions.some(t => t.transmission === y))
                              .map(v => ({ value: v, label: v })),
                          ]}
                          selected={filterState.transmission}
                          onChange={v => updateFilter('transmission', v)}
                          placeholder="Vites tipi seç (çoklu)"
                        />
                      </div>

                      {/* Kasa Tipi — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Kasa Tipi
                        </label>
                        <MultiSelectChips
                          options={[
                            ...bodyTypes.map(b => ({ value: b.bodyType, label: b.bodyType, count: b.count })),
                            ...FILTER_OPTIONS.kasa
                              .filter(y => !bodyTypes.some(b => b.bodyType === y))
                              .map(v => ({ value: v, label: v })),
                          ]}
                          selected={filterState.bodyType}
                          onChange={v => updateFilter('bodyType', v)}
                          placeholder="Kasa tipi seç (çoklu)"
                        />
                      </div>

                      {/* Trim / Motor Detayı — kendi kutusu (cascade dropdown) */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Trim / Motor Detayı {filterState.make.length === 1 && filterState.model.length === 1 ? `(${trims.length})` : ''}
                        </label>
                        {filterState.make.length === 1 && filterState.model.length === 1 && trims.length > 0 ? (
                          <MultiSelectChips
                            options={trims.map(t => ({ value: t.trim, label: t.trim, count: t.count }))}
                            selected={filterState.trim ? [filterState.trim] : []}
                            onChange={v => updateFilter('trim', v[v.length - 1] || '')}
                            placeholder="Trim seç (tek) veya aşağıdan serbest yaz"
                          />
                        ) : null}
                        <input
                          value={filterState.trim}
                          onChange={e => updateFilter('trim', e.target.value)}
                          placeholder={
                            filterState.make.length === 1 && filterState.model.length === 1
                              ? "örn: 320i M Sport, 1.5 TDI (veya yukarıdan seç)"
                              : "Önce tek marka + tek model seç, sonra trim seçebilirsin"
                          }
                          disabled={filterState.make.length !== 1 || filterState.model.length !== 1}
                          className="w-full mt-2 px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-xs text-white placeholder-gray-600 disabled:opacity-50"
                        />
                      </div>

                      {/* Renk — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Renk
                        </label>
                        <MultiSelectChips
                          options={colorOptions}
                          selected={filterState.color}
                          onChange={v => updateFilter('color', v)}
                          placeholder="Renk seç (çoklu)"
                        />
                      </div>

                      {/* Renk Hariç Tut — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Renk Hariç Tut
                        </label>
                        <MultiSelectChips
                          options={colorOptions}
                          selected={filterState.colorExclude}
                          onChange={v => updateFilter('colorExclude', v)}
                          placeholder="Bu renkler OLMASIN"
                        />
                      </div>

                      {/* Şehir — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Şehir
                        </label>
                        <MultiSelectChips
                          options={FILTER_OPTIONS.sehir.map(v => ({ value: v, label: v }))}
                          selected={filterState.city}
                          onChange={v => updateFilter('city', v)}
                          placeholder="Şehir seç (çoklu)"
                        />
                      </div>

                      {/* İlçe — kendi kutusu (cascade) */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          İlçe {filterState.city.length === 1 ? `(${districts.length})` : filterState.city.length > 1 ? '(tek şehir seç)' : ''}
                        </label>
                        <MultiSelectChips
                          options={filterState.city.length === 1 ? districts.map(d => ({ value: d.district, label: d.district, count: d.count })) : []}
                          selected={filterState.district}
                          onChange={v => updateFilter('district', v)}
                          placeholder={filterState.city.length === 1 ? 'İlçe seç (çoklu)' : 'Önce tek şehir seç'}
                        />
                      </div>

                      {/* Satıcı Tipi — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Satıcı Tipi
                        </label>
                        <MultiSelectChips
                          options={FILTER_OPTIONS.satici.map(v => ({ value: v, label: v }))}
                          selected={filterState.sellerType}
                          onChange={v => updateFilter('sellerType', v)}
                          placeholder="Satıcı tipi seç (çoklu)"
                        />
                      </div>

                      {/* Kazalı Durumu — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Kazalı / Hasar Durumu
                        </label>
                        <MultiSelectChips
                          options={FILTER_OPTIONS.kazali.map(v => ({ value: v.value, label: v.label }))}
                          selected={filterState.accidentStatus}
                          onChange={v => updateFilter('accidentStatus', v)}
                          placeholder="Kazalı durumu seç (çoklu)"
                        />
                      </div>

                      {/* Otodedektif Puanı Min — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Minimum Otodedektif Puanı (Fırsat Skoru)
                        </label>
                        <StarPicker
                          value={filterState.dealScoreMin}
                          onChange={v => updateFilter('dealScoreMin', v)}
                        />
                      </div>

                      {/* Fırsat Etiketi — kendi kutusu */}
                      <div className="p-3 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                        <label className="text-[10px] font-semibold text-orange-500 mb-2 block uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Fırsat Etiketi
                        </label>
                        <MultiSelectChips
                          options={FILTER_OPTIONS.firsat.map(v => ({ value: v, label: v }))}
                          selected={filterState.dealTag}
                          onChange={v => updateFilter('dealTag', v)}
                          placeholder="Fırsat etiketi seç (çoklu)"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── BİLDİRİM KANALLARI ───────────────────────────────── */}
              <div className="space-y-2 pt-2 border-t border-[#2A2A2A]">
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
                    Alarm Kur ({activeFilterCount} filtre)
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
