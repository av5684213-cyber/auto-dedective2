'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { TrendingUp, BarChart3, PieChart as PieIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'

const DEAL_COLORS: Record<string, string> = {
  'Harika Fırsat': '#16a34a',
  'İyi Fiyat': '#65a30d',
  'Piyasa Fiyatı': '#eab308',
  'Piyasa Üstü': '#ea580c',
  'Pahalı': '#dc2626',
  'Değerlendirilemedi': '#9ca3af',
}

const SOURCE_COLORS: Record<string, string> = {
  'letgo': '#ff6f00',
  'otosor': '#2563eb',
  'intercity2': '#7c3aed',
  'fordikinciel': '#dc2626',
}

const formatPrice = (v: number) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
  return v.toString()
}

export function PriceTrends() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/admin/trends')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Fırsat etiketine tıklayınca o etikete sahip ilanları listele
  const handleDealTagClick = (tag: string) => {
    router.push(`/?dealTag=${encodeURIComponent(tag)}`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data) return null

  // Defensive: API bazen boş/pars hatalı dönebilir
  const deals = Array.isArray(data.deals) ? data.deals : []
  const sources = Array.isArray(data.sources) ? data.sources : []
  const years = Array.isArray(data.years) ? data.years : []
  const makes = Array.isArray(data.makes) ? data.makes : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Marka Bazlı Ortalama Fiyat — scroll eklenebilir */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base min-w-0">
                <BarChart3 className="h-5 w-5 text-orange-600" />
                <span className="truncate min-w-0">Marka Bazlı Ortalama Fiyat (Top 15)</span>
              </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border border-border/40 p-2">
            <ResponsiveContainer width="100%" height={Math.max(300, makes.length * 32)}>
              <BarChart data={makes} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tickFormatter={formatPrice}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <YAxis
                  type="category"
                  dataKey="make"
                  width={100}
                  tick={{ fontSize: 11, fill: '#374151' }}
                />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString('tr-TR')} TL`, 'Ort. Fiyat']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar
                  dataKey="avgPrice"
                  fill="#ea580c"
                  radius={[0, 4, 4, 0]}
                  name="Ort. Fiyat"
                />
              </BarChart>
            </ResponsiveContainer>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* İki grafik yan yana */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deal Tag Dağılımı — tıklanabilir */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base min-w-0">
              <PieIcon className="h-5 w-5 text-orange-600 shrink-0" />
              <span className="truncate min-w-0">Fırsat Dağılımı</span>
              <span className="text-xs font-normal text-muted-foreground ml-auto shrink-0 hidden sm:inline">(etikete tıkla → ilanları listele)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={deals}
                  dataKey="count"
                  nameKey="tag"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(e: any) => `${e.tag}: ${e.count}`}
                  labelLine={false}
                  fontSize={10}
                  onClick={(e: any) => e?.tag && handleDealTagClick(e.tag)}
                  style={{ cursor: 'pointer' }}
                >
                  {deals.map((entry: any, i: number) => (
                    <Cell
                      key={i}
                      fill={DEAL_COLORS[entry.tag] || '#9ca3af'}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Etiket butonları — tıklanabilir */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
              {deals.map((entry: any) => (
                <button
                  key={entry.tag}
                  onClick={() => handleDealTagClick(entry.tag)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium hover:opacity-80 transition-opacity border"
                  style={{
                    backgroundColor: (DEAL_COLORS[entry.tag] || '#9ca3af') + '20',
                    color: DEAL_COLORS[entry.tag] || '#9ca3af',
                    borderColor: (DEAL_COLORS[entry.tag] || '#9ca3af') + '40',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: DEAL_COLORS[entry.tag] || '#9ca3af' }}
                  />
                  {entry.tag}
                  <span className="opacity-70">({entry.count})</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Kaynak Dağılımı */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base min-w-0">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <span className="truncate min-w-0">Kaynak Dağılımı</span>
              </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sources} margin={{ top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number, name: string) => {
                    if (name === 'count') return [v, 'İlan']
                    return [`${v.toLocaleString('tr-TR')} TL`, 'Ort. Fiyat']
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} name="count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Yıl Bazlı Ortalama Fiyat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base min-w-0">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <span className="truncate min-w-0">Yıl Bazlı Ortalama Fiyat (Son 10 yıl)</span>
              </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={years} margin={{ top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatPrice} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString('tr-TR')} TL`, 'Ort. Fiyat']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="avgPrice" fill="#ea580c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  )
}
