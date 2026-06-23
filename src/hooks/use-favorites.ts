'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Favorites Storage (localStorage-based, no auth required) ────────────
//
// Stores favorited listing IDs in localStorage. Each device/browser has
// its own favorites. No login needed — simple and effective for a
// comparison shopping tool.
//
// Storage format: string[] of listing IDs
// Storage key: 'otodedektif:favorites'

const STORAGE_KEY = 'otodedektif:favorites'
const MAX_FAVORITES = 20

export interface FavoriteItem {
  id: string
  addedAt: string // ISO string
}

function readFromStorage(): FavoriteItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is FavoriteItem =>
        x && typeof x.id === 'string' && typeof x.addedAt === 'string'
    )
  } catch {
    return []
  }
}

function writeToStorage(items: FavoriteItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    // Dispatch a custom event so other hook instances (in other components)
    // can update their state in real-time.
    window.dispatchEvent(new CustomEvent('otodedektif:favorites-changed'))
  } catch (e) {
    console.warn('[favorites] Failed to write to localStorage:', e)
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Initial load from localStorage
  useEffect(() => {
    setFavorites(readFromStorage())
    setHydrated(true)

    // Listen for changes from other hook instances
    const handler = () => setFavorites(readFromStorage())
    window.addEventListener('otodedektif:favorites-changed', handler)
    window.addEventListener('storage', handler)

    return () => {
      window.removeEventListener('otodedektif:favorites-changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  const isFavorite = useCallback(
    (id: string): boolean => favorites.some((f) => f.id === id),
    [favorites]
  )

  const addFavorite = useCallback((id: string): boolean => {
    const current = readFromStorage()
    if (current.some((f) => f.id === id)) return false // already favorite
    if (current.length >= MAX_FAVORITES) {
      console.warn(`[favorites] Max ${MAX_FAVORITES} favorites reached`)
      return false
    }
    const newItem: FavoriteItem = { id, addedAt: new Date().toISOString() }
    writeToStorage([...current, newItem])
    return true
  }, [])

  const removeFavorite = useCallback((id: string): void => {
    const current = readFromStorage()
    writeToStorage(current.filter((f) => f.id !== id))
  }, [])

  const toggleFavorite = useCallback((id: string): void => {
    const current = readFromStorage()
    if (current.some((f) => f.id === id)) {
      writeToStorage(current.filter((f) => f.id !== id))
    } else {
      if (current.length >= MAX_FAVORITES) {
        console.warn(`[favorites] Max ${MAX_FAVORITES} favorites reached`)
        return
      }
      const newItem: FavoriteItem = { id, addedAt: new Date().toISOString() }
      writeToStorage([...current, newItem])
    }
  }, [])

  const clearAll = useCallback((): void => {
    writeToStorage([])
  }, [])

  const favoriteIds = favorites.map((f) => f.id)

  return {
    favorites,
    favoriteIds,
    count: favorites.length,
    max: MAX_FAVORITES,
    hydrated,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearAll,
  }
}
