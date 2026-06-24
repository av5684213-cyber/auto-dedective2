'use client'

// Otodedektif - Yakıt Maliyeti Hesaplama Component'i
//
// Araç detay sayfasında gösterilir. Kullanıcı bir il ve yıllık km seçer,
// component API'den güncel yakıt fiyatını ve fabrika yakıt tüketim verisini
// alıp yıllık/aylık maliyeti hesaplar.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Fuel, MapPin, Gauge, Calculator, Info, AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPrice } from '@/components/price-display'

// 81 il — Türkçe karakterleriyle
const TURKISH_CITIES_81 = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya',
  'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur',
  'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne',
  'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun',
  'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir',
  'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya',
  'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop',
  'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak',
  'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale',
  'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük',
  'Kilis', 'Osmaniye', 'Düzce',
]

interface FuelCostData {
  listingId: string
  city: string
  annualKm: number
  consumption: {
    city: number | null
    highway: number | null
    combined: number
    unit: 'L' | 'kWh'
    source: 'factory' | 'estimated'
    isEstimated: boolean
    matchedFrom?: string
  }
  fuelPrice: {
    price: number
    unit: 'L' | 'kWh'
    fuelType: 'Benzin' | 'Dizel' | 'LPG' | 'Elektrik' | 'Hybrid'
    source: 'epdk' | 'fallback'
    fetchedAt: string
  }
  calculation: {
    annualCost: number
    monthlyCost: number
    annualConsumption: number
    formula: string
  }
}

interface FuelCostCalculatorProps {
  listingId: string
  /** Listing'in bulunduğu şehir (default selected city için) */
  defaultCity?: string | null
  /** Listing'in yakıt tipi (UI'da bilgi için) */
  fuelType?: string | null
}

export function FuelCostCalculator({ listingId, defaultCity, fuelType }: FuelCostCalculatorProps) {
  // Listing'in bulunduğu şehir default selected city olsun
  const initialCity = useMemo(() => {
    if (!defaultCity) return 'İstanbul'
    // Normalizasyon: küçük harfli ya da "istanbul atasehir" gibi → "İstanbul"
    const c = defaultCity.trim()
    const matched = TURKISH_CITIES_81.find(
      (city) => city.toLowerCase() === c.toLowerCase() || c.toLowerCase().startsWith(city.toLowerCase() + ' ') || city.toLowerCase().startsWith(c.toLowerCase() + ' ')
    )
    return matched || 'İstanbul'
  }, [defaultCity])

  const [city, setCity] = useState(initialCity)
  const [annualKm, setAnnualKm] = useState(15000)
  const [data, setData] = useState<FuelCostData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCost = useCallback(async () => {
    if (!listingId) return
    setLoading(true)
    setError(null)
    try {
      const url = `/api/listings/${listingId}/fuel-cost?city=${encodeURIComponent(city)}&annualKm=${annualKm}`
      const res = await fetch(url)
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError((err as Error).message || 'Hesaplama yapılamadı')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [listingId, city, annualKm])

  // İlk render ve listingId değişince fetch
  useEffect(() => {
    fetchCost()
  }, [fetchCost])

  // İl değişince de fetch (annualKm değişince input debounce'li fetch gerekir,
  // ama basitlik için hemen fetch edelim)
  const handleKmChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1000 && num <= 200000) {
      setAnnualKm(num)
    }
  }

  const turkishFormatter = new Intl.NumberFormat('tr-TR')

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Fuel className="h-5 w-5 text-amber-600" />
          Yakıt Maliyeti Hesaplama
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Fabrika yakıt tüketim verisi ve seçtiğiniz ildeki güncel yakıt fiyatına göre
          yıllık/aylak yakıt maliyetini hesaplayın.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input row: il + yıllık km */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city-select" className="text-xs flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              İl
            </Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger id="city-select" className="bg-background">
                <SelectValue placeholder="İl seçin" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TURKISH_CITIES_81.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="annual-km" className="text-xs flex items-center gap-1.5">
              <Gauge className="h-3 w-3" />
              Yıllık Kilometre
            </Label>
            <Input
              id="annual-km"
              type="number"
              min={1000}
              max={200000}
              step={1000}
              value={annualKm}
              onChange={(e) => handleKmChange(e.target.value)}
              className="bg-background"
            />
          </div>
        </div>

        {/* Quick km presets */}
        <div className="flex gap-1.5 flex-wrap">
          {[10000, 15000, 20000, 25000, 30000].map((km) => (
            <Button
              key={km}
              size="sm"
              variant={annualKm === km ? 'default' : 'outline'}
              onClick={() => setAnnualKm(km)}
              className="h-7 px-2 text-xs"
            >
              {turkishFormatter.format(km)} km
            </Button>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Hesaplanıyor...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Hesaplama yapılamadı</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* Ana sonuç kartı */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <p className="text-xs text-amber-800 dark:text-amber-200 mb-1">Yıllık Yakıt Maliyeti</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
                  {formatPrice(data.calculation.annualCost)}
                </p>
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <p className="text-xs text-amber-800 dark:text-amber-200 mb-1">Aylık Yakıt Maliyeti</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
                  {formatPrice(data.calculation.monthlyCost)}
                </p>
              </div>
            </div>

            {/* Detaylı hesaplama */}
            <div className="p-3 bg-background rounded-lg border space-y-2 text-sm">
              <div className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calculator className="h-3 w-3" />
                  Hesaplama
                </span>
                <span className="text-xs text-right font-mono">
                  {data.calculation.formula}
                </span>
              </div>

              <div className="border-t pt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Fabrika Tüketimi (Kombine)</p>
                  <p className="font-medium">
                    {data.consumption.combined} {data.consumption.unit}/100km
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Yakıt Fiyatı ({data.city})</p>
                  <p className="font-medium">
                    {data.fuelPrice.price.toFixed(2)} TL/{data.fuelPrice.unit}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Yıllık Tüketim</p>
                  <p className="font-medium">
                    {turkishFormatter.format(data.calculation.annualConsumption)} {data.consumption.unit}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Yakıt Tipi</p>
                  <p className="font-medium">{data.fuelPrice.fuelType}</p>
                </div>
              </div>

              {/* Şehir içi / şehir dışı */}
              {data.consumption.city != null && data.consumption.highway != null && (
                <div className="border-t pt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Şehir İçi Tüketimi</p>
                    <p className="font-medium">
                      {data.consumption.city} {data.consumption.unit}/100km
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Şehir Dışı Tüketimi</p>
                    <p className="font-medium">
                      {data.consumption.highway} {data.consumption.unit}/100km
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Veri kaynakları rozetleri */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge
                variant={data.consumption.isEstimated ? 'outline' : 'secondary'}
                className={data.consumption.isEstimated
                  ? 'border-orange-300 text-orange-700 bg-orange-50'
                  : 'border-green-300 text-green-700 bg-green-50'
                }
              >
                {data.consumption.isEstimated
                  ? `⚠ Tahmini tüketim (fabrika verisi yok)`
                  : `✓ Fabrika verisi (${data.consumption.matchedFrom?.split(':')[0] || 'WLTP'})`
                }
              </Badge>
              <Badge
                variant="outline"
                className={data.fuelPrice.source === 'epdk'
                  ? 'border-blue-300 text-blue-700 bg-blue-50'
                  : 'border-gray-300 text-gray-700 bg-gray-50'
                }
              >
                {data.fuelPrice.source === 'epdk'
                  ? `✓ EPDK güncel fiyat (${data.city})`
                  : `İstatistiksel ortalama fiyat (${data.city})`
                }
              </Badge>
            </div>

            {/* Fabrika verisi yoksa uyarı */}
            {data.consumption.isEstimated && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Bu araç için fabrika yakıt tüketim verisi bulunmuyor.</p>
                  <p className="mt-0.5">
                    Gösterilen değer yakıt tipine ({data.fuelPrice.fuelType}) göre genel ortalama
                    bir tahmindir. Gerçek tüketim; araç yaşına, bakım durumuna, kullanım tarzına
                    ve yol koşullarına göre değişebilir.
                  </p>
                </div>
              </div>
            )}

            {/* Info: Yakıt fiyatları değişken */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Bilgilendirme</p>
                <p className="mt-0.5">
                  Yakıt tüketim fiyatları sabit değildir. Değişenlik gösterebilir. EPDK
                  tarafından açıklanan bayi satış fiyatları ve uluslararası petrol fiyatlarından
                  etkilenir. Bu hesaplama tahmini bir değerdir.
                </p>
                {data.fuelPrice.source === 'fallback' && (
                  <p className="mt-1 text-blue-700">
                    Bu il için gerçek zamanlı EPDK verisi şu anda kullanılamıyor; istatistiksel
                    ortalama fiyat kullanılmıştır.
                  </p>
                )}
              </div>
            </div>

            {/* Listing'in yakıt tipi uyuşmazlığı uyarısı */}
            {fuelType && data.fuelPrice.fuelType && fuelType.toLowerCase() !== data.fuelPrice.fuelType.toLowerCase() && (
              <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>
                  Bu ilanın yakıt tipi <strong>{fuelType}</strong> olarak belirtilmiş.
                  Hesaplama <strong>{data.fuelPrice.fuelType}</strong> fiyatı kullanılarak yapıldı
                  (hibrit araçlar için benzin fiyatı kullanılır).
                </p>
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
