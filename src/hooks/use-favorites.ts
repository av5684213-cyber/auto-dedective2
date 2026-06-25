'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'

// ── Favorites Hook (DB-backed, kullanıcı bazlı) ─────────────────────────
//
// Giriş yapmış kullanıcının favorileri DB'de (UserFavorite tablosu) saklanır.
// /api/favorites endpoint'i üzerinden GET/POST/DELETE yapılır.
//
// Giriş yapmamış kullanıcı için favoriler devre dışıdır (count=0, toggle no-op).

const MAX_FAVORITES = 50

export interface FavoriteItem {
  id: string
  addedAt: string
}

export function useFavorites() {
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && !!session?.user?.email

  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)

  // Favorileri DB'den yükle (giriş yapmış kullanıcı için)
  const refreshFavorites = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteIds([])
      setHydrated(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/favorites')
      if (!res.ok) {
        setFavoriteIds([])
        return
      }
      const data = await res.json()
      setFavoriteIds(Array.isArray(data.favorites) ? data.favorites : [])
    } catch (err) {
      console.warn('[favorites] Failed to load:', err)
      setFavoriteIds([])
    } finally {
      setHydrated(true)
      setLoading(false)
    }
  }, [isAuthenticated])

  // İlk yükleme + auth durumu değişince yeniden yükle
  useEffect(() => {
    refreshFavorites()
  }, [refreshFavorites])

  const isFavorite = useCallback(
    (id: string): boolean => favoriteIds.includes(id),
    [favoriteIds]
  )

  const toggleFavorite = useCallback(async (id: string): Promise<void> => {
    if (!isAuthenticated) return
    const isFav = favoriteIds.includes(id)
    // Optimistic update — UI hemen güncellensin
    setFavoriteIds(prev => isFav ? prev.filter(x => x !== id) : [...prev, id])
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id, action: isFav ? 'remove' : 'add' }),
      })
      if (!res.ok) {
        // Revert on error
        setFavoriteIds(prev => isFav ? [...prev, id] : prev.filter(x => x !== id))
      }
    } catch (err) {
      // Revert on error
      setFavoriteIds(prev => isFav ? [...prev, id] : prev.filter(x => x !== id))
    }
  }, [isAuthenticated, favoriteIds])

  const addFavorite = useCallback(async (id: string): Promise<boolean> => {
    if (!isAuthenticated) return false
    if (favoriteIds.includes(id)) return false
    if (favoriteIds.length >= MAX_FAVORITES) return false
    await toggleFavorite(id)
    return true
  }, [isAuthenticated, favoriteIds, toggleFavorite])

  const removeFavorite = useCallback(async (id: string): Promise<void> => {
    if (!isAuthenticated) return
    await toggleFavorite(id)
  }, [isAuthenticated, toggleFavorite])

  const clearAll = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return
    // Tek tek sil
    await Promise.all(favoriteIds.map(id =>
      fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id, action: 'remove' }),
      }).catch(() => {})
    ))
    setFavoriteIds([])
  }, [isAuthenticated, favoriteIds])

  const favorites = useMemo<FavoriteItem[]>(
    () => favoriteIds.map(id => ({ id, addedAt: new Date().toISOString() })),
    [favoriteIds]
  )

  return {
    favorites,
    favoriteIds,
    count: favoriteIds.length,
    max: MAX_FAVORITES,
    hydrated,
    loading,
    isAuthenticated,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearAll,
    refreshFavorites,
  }
}
