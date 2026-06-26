'use client'
// Otodedektif - Last update: 2026-06-23

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, BarChart3, Car } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchBar } from '@/components/search-bar'
import { FilterSidebar, FilterButton } from '@/components/filter-sidebar'
import { Button } from '@/components/ui/button'
import { ListingGrid } from '@/components/listing-grid'
import { StatsDashboard } from '@/components/stats-dashboard'
import { UserMenu } from '@/components/auth/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { AlertManager } from '@/components/alerts/alert-manager'
import { Bell } from 'lucide-react'
import type { SearchFilters, SearchResult, ListingWithScore, SearchAggregations } from '@/lib/types'

const DEFAULT_FILTERS: SearchFilters = {
  sortBy: 'deal_score_desc',
  page: 1,
  limit: 20,
}

function parseUrlFilters(): SearchFilters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS
  const params = new URLSearchParams(window.location.search)
  const filters: SearchFilters = { ...DEFAULT_FILTERS }
  if (params.get('make')) filters.make = params.get('make')!
  if (params.get('model')) filters.model = params.get('model')!
  if (params.get('yearMin')) filters.yearMin = parseInt(params.get('yearMin')!)
  if (params.get('yearMax')) filters.yearMax = parseInt(params.get('yearMax')!)
  if (params.get('priceMin')) filters.priceMin = parseInt(params.get('priceMin')!)
  if (params.get('priceMax')) filters.priceMax = parseInt(params.get('priceMax')!)
  if (params.get('mileageMax')) filters.mileageMax = parseInt(params.get('mileageMax')!)
  if (params.get('fuelType')) filters.fuelType = params.get('fuelType')!
  if (params.get('transmission')) filters.transmission = params.get('transmission')!
  if (params.get('bodyType')) filters.bodyType = params.get('bodyType')!
  if (params.get('city')) filters.city = params.get('city')!
  if (params.get('sellerType')) filters.sellerType = params.get('sellerType')!
  if (params.get('dealTag')) filters.dealTag = params.get('dealTag')!
  if (params.get('sortBy')) filters.sortBy = params.get('sortBy') as SearchFilters['sortBy']
  if (params.get('page')) filters.page = parseInt(params.get('page')!)
  if (params.get('tab')) { /* handled separately */ }
  return filters
}

function updateUrl(filters: SearchFilters, tab: string) {
  const params = new URLSearchParams()
  if (filters.make) params.set('make', filters.make)
  if (filters.model) params.set('model', filters.model)
  if (filters.yearMin) params.set('yearMin', filters.yearMin.toString())
  if (filters.yearMax) params.set('yearMax', filters.yearMax.toString())
  if (filters.priceMin) params.set('priceMin', filters.priceMin.toString())
  if (filters.priceMax) params.set('priceMax', filters.priceMax.toString())
  if (filters.mileageMax) params.set('mileageMax', filters.mileageMax.toString())
  if (filters.fuelType) params.set('fuelType', filters.fuelType)
  if (filters.transmission) params.set('transmission', filters.transmission)
  if (filters.bodyType) params.set('bodyType', filters.bodyType)
  if (filters.city) params.set('city', filters.city)
  if (filters.sellerType) params.set('sellerType', filters.sellerType)
  if (filters.dealTag) params.set('dealTag', filters.dealTag)
  if (filters.sortBy && filters.sortBy !== 'deal_score_desc') params.set('sortBy', filters.sortBy)
  if (filters.page && filters.page > 1) params.set('page', filters.page.toString())
  if (tab !== 'search') params.set('tab', tab)
  const qs = params.toString()
  window.history.replaceState(null, '', qs ? `?${qs}` : '/')
}

export default function Home() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'search' | 'dashboard'>('search')
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [aggregations, setAggregations] = useState<SearchAggregations | null>(null)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Initialize from URL
  useEffect(() => {
    const urlFilters = parseUrlFilters()
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    setFilters(urlFilters)
    if (tab === 'dashboard') setActiveTab('dashboard')
  }, [])

  // Fetch listings
  const fetchListings = useCallback(async (f: SearchFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.make) params.set('make', f.make)
      if (f.model) params.set('model', f.model)
      if (f.yearMin) params.set('yearMin', f.yearMin.toString())
      if (f.yearMax) params.set('yearMax', f.yearMax.toString())
      if (f.priceMin) params.set('priceMin', f.priceMin.toString())
      if (f.priceMax) params.set('priceMax', f.priceMax.toString())
      if (f.mileageMax) params.set('mileageMax', f.mileageMax.toString())
      if (f.fuelType) params.set('fuelType', f.fuelType)
      if (f.transmission) params.set('transmission', f.transmission)
      if (f.bodyType) params.set('bodyType', f.bodyType)
      if (f.city) params.set('city', f.city)
      if (f.sellerType) params.set('sellerType', f.sellerType)
      if (f.dealTag) params.set('dealTag', f.dealTag)
      if (f.sortBy) params.set('sortBy', f.sortBy)
      if (f.page) params.set('page', f.page.toString())
      if (f.limit) params.set('limit', f.limit.toString())

      const res = await fetch(`/api/listings?${params.toString()}`)
      if (!res.ok) {
        console.error('Listings API returned non-OK status:', res.status)
        setResults({
          listings: [], total: 0, page: f.page || 1, limit: f.limit || 20, totalPages: 0,
          aggregations: {
            makes: [], cities: [], fuelTypes: [], transmissions: [], bodyTypes: [],
            priceRange: { min: 0, max: 0 }, yearRange: { min: 0, max: 0 },
            totalActive: 0, dealBreakdown: [],
          },
        })
        return
      }
      const data = await res.json() as SearchResult
      const safeData: SearchResult = {
        listings: Array.isArray(data?.listings) ? data.listings : [],
        total: typeof data?.total === 'number' ? data.total : 0,
        page: typeof data?.page === 'number' ? data.page : (f.page || 1),
        limit: typeof data?.limit === 'number' ? data.limit : (f.limit || 20),
        totalPages: typeof data?.totalPages === 'number' ? data.totalPages : 0,
        aggregations: data?.aggregations ?? null,
      }
      setResults(safeData)
      if (safeData.aggregations) {
        setAggregations(safeData.aggregations)
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch when filters change
  useEffect(() => {
    fetchListings(filters)
    updateUrl(filters, activeTab)
  }, [filters, fetchListings, activeTab])

  // Handlers
  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters)
  }

  const handleResetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS })
    setSearchQuery('')
  }

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    // Reset filters for a general search - the API doesn't support full-text search
    // so we rely on the filter-based approach
    if (!query) {
      setFilters(prev => ({ ...prev, page: 1 }))
    }
  }

  const handleMakeSelect = (make: string) => {
    setFilters(prev => ({
      ...prev,
      make,
      model: undefined,
      page: 1,
    }))
  }

  const handleModelSelect = (make: string, model: string) => {
    setFilters(prev => ({
      ...prev,
      make,
      model,
      page: 1,
    }))
  }

  const handleListingClick = (listing: ListingWithScore) => {
    // Popup yerine doğrudan ilan detay sayfasına yönlendir
    router.push(`/ilan/${listing.id}`)
  }

  const handleComparableClick = (listing: ListingWithScore) => {
    // Benzer ilan tıklaması da detay sayfasına gider
    router.push(`/ilan/${listing.id}`)
  }

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.make && filters.make.trim()) count++
    if (filters.model && filters.model.trim()) count++
    if (filters.yearMin) count++
    if (filters.yearMax) count++
    if (filters.priceMin) count++
    if (filters.priceMax) count++
    if (filters.mileageMax) count++
    if (filters.fuelType && filters.fuelType.trim()) count++
    if (filters.transmission && filters.transmission.trim()) count++
    if (filters.bodyType && filters.bodyType.trim()) count++
    if (filters.city && filters.city.trim()) count++
    if (filters.sellerType && filters.sellerType.trim()) count++
    if (filters.dealTag && filters.dealTag.trim()) count++
    if (filters.sortBy && filters.sortBy !== 'deal_score_desc') count++
    return count
  }, [filters])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <Car className="h-6 w-6 text-orange-600" />
            <span className="text-base font-bold">
              <span className="text-orange-600">Oto</span>
              <span className="text-amber-500">dedektif</span>
            </span>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'dashboard' | 'favorites')}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="search" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ara</span>
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Paneller</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Theme Toggle + User Menu */}
          <div className="shrink-0 flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'search' ? (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Search Bar Section */}
              <div className="bg-gradient-to-b from-card to-background border-b border-border px-4 py-6 sm:py-8">
                <SearchBar
                  onSearch={handleSearch}
                  onMakeSelect={handleMakeSelect}
                  onModelSelect={handleModelSelect}
                  currentQuery={searchQuery}
                />
              </div>

              {/* Content Area: Sidebar + Grid */}
              <div className="max-w-7xl mx-auto flex">
                <FilterSidebar
                  filters={filters}
                  aggregations={aggregations}
                  onFilterChange={handleFilterChange}
                  onReset={handleResetFilters}
                  isOpen={filterDrawerOpen}
                  onOpenChange={setFilterDrawerOpen}
                  totalResults={results?.total || 0}
                />

                <div className="flex-1 min-w-0 p-4">
                  {/* Results header + Alarm button */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FilterButton
                        onClick={() => setFilterDrawerOpen(true)}
                        activeCount={activeFilterCount}
                      />
                      {results && (
                        <span className="text-sm text-muted-foreground hidden lg:inline">
                          {results.total.toLocaleString('tr-TR')} ilan
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => setAlertOpen(true)}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-[#2A2A2A] hover:bg-[#1A1A1A] hover:text-orange-500"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Alarm Kur</span>
                    </Button>
                  </div>

                  <ListingGrid
                    listings={results?.listings || []}
                    loading={loading}
                    page={filters.page || 1}
                    totalPages={results?.totalPages || 0}
                    total={results?.total || 0}
                    onPageChange={handlePageChange}
                    onListingClick={handleListingClick}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <StatsDashboard
                onDealTagClick={(tag) => {
                  // Fırsat etiketine tıklayınca ana sayfaya dön + filter uygula
                  setView('search')
                  setFilters(prev => ({ ...prev, dealTag: tag }))
                  updateUrl({ ...filters, dealTag: tag })
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-background py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5 text-orange-600" />
            <span className="font-semibold text-orange-700">Otodedektif</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <p>
            Tüm İkinci El Araç İlanları Tek Bir Adreste — Tüm platformları tek aramada karşılaştırın
          </p>
        </div>
      </footer>

      {/* Alert Manager Modal */}
      <AlertManager
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        currentFilters={filters}
      />
    </div>
  )
}
