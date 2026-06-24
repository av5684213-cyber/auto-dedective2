'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SearchBarProps {
  onSearch: (query: string) => void
  onMakeSelect: (make: string) => void
  onModelSelect: (make: string, model: string) => void
  currentQuery?: string
}

interface Suggestion {
  type: 'make' | 'model'
  name: string
  make?: string
}

const TOP_MAKES = ['BMW', 'Mercedes-Benz', 'Volkswagen', 'Toyota', 'Audi', 'Ford', 'Renault', 'Fiat', 'Hyundai', 'Honda']

export function SearchBar({ onSearch, onMakeSelect, onModelSelect, currentQuery = '' }: SearchBarProps) {
  const [query, setQuery] = useState(currentQuery)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/listings/suggestions?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      const results: Suggestion[] = []
      if (data.makes) {
        data.makes.forEach((m: string) => results.push({ type: 'make', name: m }))
      }
      if (data.models) {
        data.models.forEach((m: { model: string; make: string }) => results.push({ type: 'model', name: m.model, make: m.make }))
      }
      setSuggestions(results.slice(0, 8))
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setShowSuggestions(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val)
    }, 250)
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setQuery(suggestion.name)
    setShowSuggestions(false)
    if (suggestion.type === 'make') {
      onMakeSelect(suggestion.name)
    } else {
      if (suggestion.make) {
        onModelSelect(suggestion.make, suggestion.name)
      } else {
        onSearch(suggestion.name)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowSuggestions(false)
    onSearch(query)
  }

  const handleClear = () => {
    setQuery('')
    setSuggestions([])
    onSearch('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      {/* Hero Section */}
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-5xl font-extrabold tracking-tight font-display"
        >
          <span className="text-orange-600">Oto</span>
          <span className="text-amber-500">dedektif</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-muted-foreground mt-2 text-sm md:text-base"
        >
          Tüm İkinci El Araç İlanları Tek Bir Adreste
        </motion.p>
      </div>

      {/* Search Input */}
      <div ref={wrapperRef} className="relative max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Marka, model veya anahtar kelime ara..."
              value={query}
              onChange={handleInputChange}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              className="pl-12 pr-12 h-13 text-base rounded-xl border-2 border-orange-200 focus:border-orange-500 focus:ring-orange-500/20 shadow-lg"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button
                key={`${s.type}-${s.name}-${i}`}
                onClick={() => handleSuggestionClick(s)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
              >
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-sm">{s.name}</span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {s.type === 'make' ? 'Marka' : 'Model'}
                </span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Loading indicator */}
        {loading && showSuggestions && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl p-4 text-center text-sm text-muted-foreground">
            Öneriler yükleniyor...
          </div>
        )}
      </div>

      {/* Quick Filter Chips */}
      <div className="max-w-2xl mx-auto mt-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {TOP_MAKES.map((make, i) => (
            <motion.div
              key={make}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.03 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMakeSelect(make)}
                className="rounded-full text-xs h-8 border-orange-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-400"
              >
                {make}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
