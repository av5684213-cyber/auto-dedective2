'use client'

import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SlidersHorizontal, RotateCcw, Filter } from 'lucide-react'
import { TURKISH_MAKES, MAKE_MODELS, FUEL_TYPES, TRANSMISSIONS, BODY_TYPES, SELLER_TYPES, DEAL_TAG_CONFIG } from '@/lib/constants'
import { DealBadge } from '@/components/deal-badge'
import type { SearchFilters, SearchAggregations } from '@/lib/types'

interface FilterSidebarProps {
  filters: SearchFilters
  aggregations: SearchAggregations | null
  onFilterChange: (filters: SearchFilters) => void
  onReset: () => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  totalResults: number
}

const turkishFormatter = new Intl.NumberFormat('tr-TR')

function FilterContent({
  filters,
  aggregations,
  onFilterChange,
  onReset,
  totalResults,
}: Omit<FilterSidebarProps, 'isOpen' | 'onOpenChange'>) {
  const makes = useMemo(() => {
    if (aggregations?.makes?.length) return aggregations.makes
    return TURKISH_MAKES.map(m => ({ name: m, count: 0 }))
  }, [aggregations])

  const models = useMemo(() => {
    if (filters.make && MAKE_MODELS[filters.make]) {
      return MAKE_MODELS[filters.make]
    }
    return []
  }, [filters.make])

  const cities = useMemo(() => {
    return aggregations?.cities || []
  }, [aggregations])

  const yearMin = aggregations?.yearRange?.min || 1990
  const yearMax = aggregations?.yearRange?.max || new Date().getFullYear() + 1
  const priceMin = aggregations?.priceRange?.min || 0
  const priceMax = aggregations?.priceRange?.max || 10000000

  const updateFilter = (key: keyof SearchFilters, value: string | number | undefined) => {
    onFilterChange({ ...filters, [key]: value || undefined, page: 1 })
  }

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = yearMax; y >= yearMin; y--) {
      years.push(y)
    }
    return years
  }, [yearMin, yearMax])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.make) count++
    if (filters.model) count++
    if (filters.yearMin) count++
    if (filters.yearMax) count++
    if (filters.priceMin) count++
    if (filters.priceMax) count++
    if (filters.mileageMax) count++
    if (filters.fuelType) count++
    if (filters.transmission) count++
    if (filters.bodyType) count++
    if (filters.city) count++
    if (filters.sellerType) count++
    if (filters.dealTag) count++
    if (filters.sortBy && filters.sortBy !== 'newest') count++
    return count
  }, [filters])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-orange-600" />
          <h3 className="font-semibold text-sm">Filtreler</h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 text-xs bg-orange-100 text-orange-700">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-foreground h-7"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Temizle
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Marka */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Marka</label>
            <Select
              value={filters.make || '_all'}
              onValueChange={(v) => updateFilter('make', v === '_all' ? undefined : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Tüm markalar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Tüm markalar</SelectItem>
                {makes.map((m) => (
                  <SelectItem key={m.name} value={m.name}>
                    {m.name} {m.count > 0 && <span className="text-muted-foreground">({m.count})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          {filters.make && models.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</label>
              <Select
                value={filters.model || '_all'}
                onValueChange={(v) => updateFilter('model', v === '_all' ? undefined : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Tüm modeller" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Tüm modeller</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Yıl Aralığı */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yıl Aralığı</label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={filters.yearMin?.toString() || '_any'}
                onValueChange={(v) => updateFilter('yearMin', v === '_any' ? undefined : parseInt(v))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="En erken" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_any">En erken</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.yearMax?.toString() || '_any'}
                onValueChange={(v) => updateFilter('yearMax', v === '_any' ? undefined : parseInt(v))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="En geç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_any">En geç</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Fiyat Aralığı */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fiyat Aralığı (₺)</label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.priceMin || ''}
                onChange={(e) => updateFilter('priceMin', e.target.value ? parseInt(e.target.value) : undefined)}
                className="h-9 text-sm"
              />
              <Input
                type="number"
                placeholder="Maks"
                value={filters.priceMax || ''}
                onChange={(e) => updateFilter('priceMax', e.target.value ? parseInt(e.target.value) : undefined)}
                className="h-9 text-sm"
              />
            </div>
            {priceMin > 0 && priceMax > 0 && (
              <div className="text-xs text-muted-foreground">
                {turkishFormatter.format(priceMin)} ₺ — {turkishFormatter.format(priceMax)} ₺
              </div>
            )}
          </div>

          <Separator />

          {/* Kilometre */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Maks. Kilometre</label>
            <Input
              type="number"
              placeholder="ör: 100000"
              value={filters.mileageMax || ''}
              onChange={(e) => updateFilter('mileageMax', e.target.value ? parseInt(e.target.value) : undefined)}
              className="h-9 text-sm"
            />
          </div>

          <Separator />

          {/* Yakıt Tipi */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yakıt Tipi</label>
            <div className="flex flex-wrap gap-1.5">
              {FUEL_TYPES.map((ft) => (
                <Button
                  key={ft}
                  variant={filters.fuelType === ft ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateFilter('fuelType', filters.fuelType === ft ? undefined : ft)}
                  className={`h-7 text-xs rounded-full ${filters.fuelType === ft ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                >
                  {ft}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Vites */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vites</label>
            <div className="flex flex-wrap gap-1.5">
              {TRANSMISSIONS.map((t) => (
                <Button
                  key={t}
                  variant={filters.transmission === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateFilter('transmission', filters.transmission === t ? undefined : t)}
                  className={`h-7 text-xs rounded-full ${filters.transmission === t ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Kasa Tipi */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kasa Tipi</label>
            <div className="flex flex-wrap gap-1.5">
              {BODY_TYPES.map((bt) => (
                <Button
                  key={bt}
                  variant={filters.bodyType === bt ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateFilter('bodyType', filters.bodyType === bt ? undefined : bt)}
                  className={`h-7 text-xs rounded-full ${filters.bodyType === bt ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                >
                  {bt}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Şehir */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Şehir</label>
            <Select
              value={filters.city || '_all'}
              onValueChange={(v) => updateFilter('city', v === '_all' ? undefined : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Tüm şehirler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Tüm şehirler</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name} ({c.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Satıcı Tipi */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Satıcı Tipi</label>
            <div className="flex flex-wrap gap-1.5">
              {SELLER_TYPES.map((st) => (
                <Button
                  key={st}
                  variant={filters.sellerType === st ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateFilter('sellerType', filters.sellerType === st ? undefined : st)}
                  className={`h-7 text-xs rounded-full ${filters.sellerType === st ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Fırsat Etiketi */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fırsat Etiketi</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(DEAL_TAG_CONFIG).map((tag) => (
                <button
                  key={tag}
                  onClick={() => updateFilter('dealTag', filters.dealTag === tag ? undefined : tag)}
                  className={`transition-all ${filters.dealTag === tag ? 'ring-2 ring-offset-1 ring-orange-500 rounded-full' : 'opacity-70 hover:opacity-100 rounded-full'}`}
                >
                  <DealBadge tag={tag} />
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Sıralama */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sıralama</label>
            <Select
              value={filters.sortBy || 'newest'}
              onValueChange={(v) => updateFilter('sortBy', v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">En Yeni</SelectItem>
                <SelectItem value="price_asc">Fiyat: Düşükten Yükseğe</SelectItem>
                <SelectItem value="price_desc">Fiyat: Yüksekten Düşüğe</SelectItem>
                <SelectItem value="year_desc">Yıl: En Yeni</SelectItem>
                <SelectItem value="year_asc">Yıl: En Eski</SelectItem>
                <SelectItem value="mileage_asc">Kilometre: En Düşük</SelectItem>
                <SelectItem value="deal_score_desc">En İyi Fırsat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <div className="text-xs text-muted-foreground text-center">
          {totalResults.toLocaleString('tr-TR')} ilan bulundu
        </div>
      </div>
    </div>
  )
}

export function FilterSidebar(props: FilterSidebarProps) {
  const { isOpen, onOpenChange, ...contentProps } = props

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[280px] flex-shrink-0 border-r bg-card overflow-hidden">
        <FilterContent {...contentProps} />
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Filtreler</SheetTitle>
          </SheetHeader>
          <FilterContent {...contentProps} />
        </SheetContent>
      </Sheet>
    </>
  )
}

export function FilterButton({ onClick, activeCount }: { onClick: () => void; activeCount: number }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="lg:hidden rounded-full gap-1.5 border-orange-200"
    >
      <Filter className="h-4 w-4" />
      Filtreler
      {activeCount > 0 && (
        <Badge className="h-5 w-5 p-0 flex items-center justify-center bg-orange-600 text-white text-xs">
          {activeCount}
        </Badge>
      )}
    </Button>
  )
}
