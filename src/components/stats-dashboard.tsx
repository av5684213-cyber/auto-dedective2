'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RefreshCw, Car, MapPin, BarChart3, TrendingUp, Database,
  Clock, CheckCircle, XCircle, Loader2, Zap
} from 'lucide-react'
import { DealBadge } from '@/components/deal-badge'
import { formatPrice } from '@/components/price-display'
import { LoanCalculator } from '@/components/loan-calculator'
import { PriceTrends } from '@/components/price-trends'
import { SOURCE_PLATFORMS, DEAL_TAG_CONFIG } from '@/lib/constants'

interface StatsData {
  totalActive: number
  listingsPerSource: { sourceName: string; count: number }[]
  listingsPerMake: { make: string; count: number }[]
  listingsPerCity: { city: string; count: number }[]
  dealTagDistribution: { tag: string; count: number }[]
  avgPriceByMake: { make: string; avgPrice: number; count: number }[]
  recentScrapeLogs: {
    id: string
    sourceName: string
    startTime: string
    endTime: string | null
    status: string
    itemsFound: number
    itemsSaved: number
    errorMsg: string | null
    durationMs: number | null
  }[]
  cacheStats: { keys: number; hits: number; misses: number; hitRate: number }
}

export function StatsDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) {
        console.error('Stats API returned non-OK status:', res.status)
        setStats(null)
        return
      }
      const data = await res.json()
      const safeStats: StatsData = {
        totalActive: typeof data?.totalActive === 'number' ? data.totalActive : 0,
        listingsPerSource: Array.isArray(data?.listingsPerSource) ? data.listingsPerSource : [],
        listingsPerMake: Array.isArray(data?.listingsPerMake) ? data.listingsPerMake : [],
        listingsPerCity: Array.isArray(data?.listingsPerCity) ? data.listingsPerCity : [],
        dealTagDistribution: Array.isArray(data?.dealTagDistribution) ? data.dealTagDistribution : [],
        avgPriceByMake: Array.isArray(data?.avgPriceByMake) ? data.avgPriceByMake : [],
        recentScrapeLogs: Array.isArray(data?.recentScrapeLogs) ? data.recentScrapeLogs : [],
        cacheStats: {
          keys: data?.cacheStats?.keys ?? 0,
          hits: data?.cacheStats?.hits ?? 0,
          misses: data?.cacheStats?.misses ?? 0,
          hitRate: data?.cacheStats?.hitRate ?? 0,
        },
      }
      setStats(safeStats)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleScrape = async () => {
    setScraping(true)
    try {
      await fetch('/api/admin/scrape', { method: 'POST' })
      // Wait a bit then refresh
      setTimeout(() => {
        fetchStats()
        setScraping(false)
      }, 2000)
    } catch {
      setScraping(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-32 mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-6 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const maxSourceCount = Math.max(...stats.listingsPerSource.map(s => s.count), 1)

  return (
    <div className="space-y-4 p-4 pt-6 max-w-6xl mx-auto">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="border-orange-200 bg-gradient-to-br from-[#1A1A1A] to-[#0F0F0F]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Car className="h-4 w-4" />
                <span className="text-xs font-medium">Toplam İlan</span>
              </div>
              <p className="text-2xl font-bold text-orange-700">
                {stats.totalActive.toLocaleString('tr-TR')}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Database className="h-4 w-4" />
                <span className="text-xs font-medium">Kaynak Sayısı</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">
                {stats.listingsPerSource.length}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-xs font-medium">Önbellek Oranı</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                %{stats.cacheStats?.hitRate?.toFixed(0) || '0'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Şehir Sayısı</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {stats.listingsPerCity.length}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleScrape}
          disabled={scraping}
          className="bg-orange-600 hover:bg-orange-700 gap-2"
        >
          {scraping ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Veriler Yenileniyor...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Verileri Yenile
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Listings per Source */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-orange-600" />
                Kaynak Bazlı İlan Sayısı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {stats.listingsPerSource.map((s) => {
                  const platform = SOURCE_PLATFORMS.find(p => p.name === s.sourceName)
                  const percentage = (s.count / maxSourceCount) * 100
                  return (
                    <div key={s.sourceName} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          {platform?.icon && <span>{platform.icon}</span>}
                          {platform?.displayName || s.sourceName}
                        </span>
                        <span className="font-medium">{s.count.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: platform?.color || '#6b7280' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Deal Tag Distribution */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                Fırsat Dağılımı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {stats.dealTagDistribution.map((d) => (
                  <div key={d.tag} className="flex items-center gap-1.5">
                    <DealBadge tag={d.tag} />
                    <span className="text-sm font-medium">{d.count}</span>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              {/* Visual bar */}
              <div className="flex h-6 rounded-full overflow-hidden">
                {stats.dealTagDistribution.map((d) => {
                  const config = DEAL_TAG_CONFIG[d.tag]
                  const percentage = (d.count / stats.totalActive) * 100
                  if (!config || percentage < 0.5) return null
                  return (
                    <div
                      key={d.tag}
                      className="flex items-center justify-center text-[9px] font-medium"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: config.bgColor,
                        color: config.color,
                        minWidth: percentage > 3 ? undefined : '2%',
                      }}
                    >
                      {percentage > 6 ? `${Math.round(percentage)}%` : ''}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Average Price by Make */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Marka Bazlı Ortalama Fiyat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-72">
                <div className="space-y-2">
                  {stats.avgPriceByMake.map((m) => (
                    <div key={m.make} className="flex items-center justify-between py-1.5 text-sm border-b border-dashed border-muted last:border-0">
                      <span className="font-medium">{m.make}</span>
                      <div className="text-right">
                        <span className="font-semibold">{formatPrice(m.avgPrice)}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">({m.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Cities */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-500" />
                En Çok İlan Olan Şehirler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.listingsPerCity.map((c, i) => (
                  <Badge
                    key={c.city}
                    variant={i < 3 ? 'default' : 'secondary'}
                    className={`${i < 3 ? 'bg-orange-600' : ''} gap-1`}
                  >
                    <MapPin className="h-3 w-3" />
                    {c.city}
                    <span className="text-xs opacity-80">({c.count})</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Scrape Logs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Son Tarama Kayıtları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Kaynak</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Durum</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Bulunan</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Kaydedilen</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Süre</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Zaman</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentScrapeLogs.slice(0, 10).map((log) => {
                    const platform = SOURCE_PLATFORMS.find(p => p.name === log.sourceName)
                    return (
                      <tr key={log.id} className="border-b border-dashed border-muted">
                        <td className="py-2">
                          <span className="flex items-center gap-1.5">
                            {platform?.icon && <span>{platform.icon}</span>}
                            {platform?.displayName || log.sourceName}
                          </span>
                        </td>
                        <td className="py-2">
                          {log.status === 'success' ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" /> Başarılı
                            </span>
                          ) : log.status === 'failed' ? (
                            <span className="flex items-center gap-1 text-red-500">
                              <XCircle className="h-3.5 w-3.5" /> Başarısız
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Çalışıyor
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">{log.itemsFound.toLocaleString('tr-TR')}</td>
                        <td className="py-2 text-right">{log.itemsSaved.toLocaleString('tr-TR')}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}
                        </td>
                        <td className="py-2 text-muted-foreground text-xs">
                          {log.startTime ? new Date(log.startTime).toLocaleString('tr-TR') : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Listings per Make */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-orange-600" />
              Marka Bazlı İlan Sayısı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.listingsPerMake.map((m, i) => (
                <Badge
                  key={m.make}
                  variant={i < 5 ? 'default' : 'secondary'}
                  className={`${i < 5 ? 'bg-orange-600' : ''} gap-1`}
                >
                  {m.make}
                  <span className="text-xs opacity-80">({m.count})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Kredi Hesaplayıcı */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-2"
        >
          <LoanCalculator />
        </motion.div>

        {/* Fiyat Trend Grafikleri */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-2"
        >
          <PriceTrends />
        </motion.div>
      </motion.div>
    </div>
  )
}
