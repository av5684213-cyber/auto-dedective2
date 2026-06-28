'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Listing {
  id: string
  sourceName: string
  make: string
  model: string
  year: number
  price: number
  city: string | null
  isActive: boolean
  isDeleted: boolean
  matchStatus: string | null
  matchConfidence: number | null
  variantId: string | null
  variantName: string | null
}

interface CatalogBrand {
  id: string
  name: string
  series: Array<{
    id: string
    name: string
    variants: Array<{ id: string; name: string }>
  }>
}

export default function ListingsManager({
  initialListings,
  sources,
  catalog,
  filters,
}: {
  initialListings: Listing[]
  sources: string[]
  catalog: CatalogBrand[]
  filters: { source: string; matchStatus: string; q: string }
}) {
  const router = useRouter()
  const [listings, setListings] = useState(initialListings)
  const [editing, setEditing] = useState<string | null>(null)
  const [matchModal, setMatchModal] = useState<string | null>(null)

  // Eşleştirme modalı state
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedSeries, setSelectedSeries] = useState('')
  const [selectedVariant, setSelectedVariant] = useState('')

  const seriesForBrand = useMemo(() => {
    return catalog.find((b) => b.id === selectedBrand)?.series || []
  }, [catalog, selectedBrand])

  const variantsForSeries = useMemo(() => {
    return seriesForBrand.find((s) => s.id === selectedSeries)?.variants || []
  }, [seriesForBrand, selectedSeries])

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(filters)
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    router.push(`/admin/listings?${params.toString()}`)
  }

  const updateListing = async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const json = await res.json()
      setListings((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                ...data,
                isActive: data.isActive ?? l.isActive,
                isDeleted: data.isDeleted ?? l.isDeleted,
                price: data.price ?? l.price,
              }
            : l,
        ),
      )
    }
  }

  const submitMatch = async (listingId: string) => {
    if (!selectedVariant) return
    await updateListing(listingId, { variantId: selectedVariant })
    setMatchModal(null)
    setSelectedBrand('')
    setSelectedSeries('')
    setSelectedVariant('')
  }

  const STATUS_COLORS: Record<string, string> = {
    matched: 'bg-green-100 text-green-800',
    unmatched: 'bg-red-100 text-red-800',
    manual_review: 'bg-yellow-100 text-yellow-800',
  }

  return (
    <div>
      {/* Filtreler */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filters.source}
          onChange={(e) => updateFilter('source', e.target.value)}
          className="px-3 py-1.5 text-sm border rounded bg-card"
        >
          <option value="all">Tüm Kaynaklar</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filters.matchStatus}
          onChange={(e) => updateFilter('matchStatus', e.target.value)}
          className="px-3 py-1.5 text-sm border rounded bg-card"
        >
          <option value="all">Tüm Durumlar</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
          <option value="manual_review">Manual Review</option>
        </select>

        <input
          type="text"
          placeholder="Ara…"
          defaultValue={filters.q}
          onChange={(e) => updateFilter('q', e.target.value)}
          className="px-3 py-1.5 text-sm border rounded bg-card flex-1 min-w-32"
        />
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto border rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 text-left">Kaynak</th>
              <th className="p-3 text-left">Başlık</th>
              <th className="p-3 text-left">Fiyat</th>
              <th className="p-3 text-left">Şehir</th>
              <th className="p-3 text-left">Eşleşme</th>
              <th className="p-3 text-left">Durum</th>
              <th className="p-3 text-left">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {listings.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Filtrelerle eşleşen ilan yok.
                </td>
              </tr>
            ) : (
              listings.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-xs">{l.sourceName}</td>
                  <td className="p-3">
                    <Link href={`/ilan/${l.id}`} target="_blank" className="hover:underline">
                      {l.make} {l.model} ({l.year})
                    </Link>
                    {l.variantName && (
                      <p className="text-xs text-muted-foreground">{l.variantName}</p>
                    )}
                  </td>
                  <td className="p-3">
                    {editing === l.id ? (
                      <input
                        type="number"
                        defaultValue={l.price}
                        onBlur={(e) => {
                          updateListing(l.id, { price: Number(e.target.value) })
                          setEditing(null)
                        }}
                        className="w-24 px-1 py-0.5 text-xs border rounded"
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => setEditing(l.id)}
                        className="cursor-pointer hover:bg-accent px-1 rounded"
                      >
                        {l.price.toLocaleString('tr-TR')} ₺
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs">{l.city || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[l.matchStatus || ''] || 'bg-gray-100'}`}>
                      {l.matchStatus || '—'}
                    </span>
                    {l.matchConfidence !== null && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({(l.matchConfidence * 100).toFixed(0)}%)
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {l.isDeleted ? (
                      <span className="text-red-600 text-xs">Silinmiş</span>
                    ) : l.isActive ? (
                      <span className="text-green-600 text-xs">Aktif</span>
                    ) : (
                      <span className="text-gray-500 text-xs">Gizli</span>
                    )}
                  </td>
                  <td className="p-3 space-y-1">
                    <button
                      onClick={() => updateListing(l.id, { isActive: !l.isActive })}
                      className="block text-xs text-primary hover:underline"
                    >
                      {l.isActive ? 'Gizle' : 'Göster'}
                    </button>
                    <button
                      onClick={() => setMatchModal(l.id)}
                      className="block text-xs text-primary hover:underline"
                    >
                      Eşleştir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Eşleştirme Modalı */}
      {matchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Manuel Eşleştirme</h3>
            <p className="text-sm text-muted-foreground mb-4">
              İlanı katalogdaki bir varyanta bağla.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Marka</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value)
                    setSelectedSeries('')
                    setSelectedVariant('')
                  }}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
                >
                  <option value="">Seçiniz…</option>
                  {catalog.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Seri</label>
                <select
                  value={selectedSeries}
                  onChange={(e) => {
                    setSelectedSeries(e.target.value)
                    setSelectedVariant('')
                  }}
                  disabled={!selectedBrand}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background disabled:opacity-50"
                >
                  <option value="">Seçiniz…</option>
                  {seriesForBrand.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Varyant</label>
                <select
                  value={selectedVariant}
                  onChange={(e) => setSelectedVariant(e.target.value)}
                  disabled={!selectedSeries}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background disabled:opacity-50"
                >
                  <option value="">Seçiniz…</option>
                  {variantsForSeries.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  setMatchModal(null)
                  setSelectedBrand('')
                  setSelectedSeries('')
                  setSelectedVariant('')
                }}
                className="px-4 py-2 text-sm border rounded"
              >
                İptal
              </button>
              <button
                onClick={() => submitMatch(matchModal)}
                disabled={!selectedVariant}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
