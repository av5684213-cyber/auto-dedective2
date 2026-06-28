'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Visit {
  id: string
  dealerId: string | null
  dealerName: string | null
  galleryName: string | null
  city: string
  contactName: string | null
  status: string
  notes: string | null
  visitDate: string
}

interface Dealer {
  id: string
  name: string
  city: string
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planlandı',
  visited: 'Ziyaret Edildi',
  negotiating: 'Görüşülüyor',
  signed: 'Anlaşma Sağlandı',
  rejected: 'Reddedildi',
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-800',
  visited: 'bg-yellow-100 text-yellow-800',
  negotiating: 'bg-purple-100 text-purple-800',
  signed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function SalesPipelineClient({
  initialVisits,
  dealers,
  cities,
  filters,
}: {
  initialVisits: Visit[]
  dealers: Dealer[]
  cities: string[]
  filters: { status: string; city: string }
}) {
  const router = useRouter()
  const [visits, setVisits] = useState(initialVisits)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    dealerId: '', galleryName: '', city: '', contactName: '',
    status: 'visited', notes: '', visitDate: new Date().toISOString().split('T')[0],
  })

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(filters)
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    router.push(`/admin/sales-pipeline?${params.toString()}`)
  }

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch('/api/admin/sales-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/admin/sales-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        dealerId: form.dealerId || null,
        visitDate: new Date(form.visitDate).toISOString(),
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setVisits((prev) => [
        {
          ...data.visit,
          visitDate: data.visit.visitDate,
          dealerName: dealers.find((d) => d.id === data.visit.dealerId)?.name || null,
        },
        ...prev,
      ])
      setForm({
        dealerId: '', galleryName: '', city: '', contactName: '',
        status: 'visited', notes: '', visitDate: new Date().toISOString().split('T')[0],
      })
      setShowForm(false)
    }
  }

  // Kanban tarzı gruplama
  const grouped: Record<string, Visit[]> = {
    planned: [], visited: [], negotiating: [], signed: [], rejected: [],
  }
  visits.forEach((v) => {
    if (grouped[v.status]) grouped[v.status].push(v)
  })

  return (
    <div>
      {/* Üst bar */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex gap-2">
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="px-3 py-1.5 text-sm border rounded bg-card"
          >
            <option value="all">Tüm Durumlar</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={filters.city}
            onChange={(e) => updateFilter('city', e.target.value)}
            className="px-3 py-1.5 text-sm border rounded bg-card"
          >
            <option value="all">Tüm Şehirler</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded"
        >
          + Yeni Ziyaret
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card border rounded-lg p-5 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Galeri (kayıtlı)</label>
            <select
              value={form.dealerId}
              onChange={(e) => setForm({ ...form, dealerId: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            >
              <option value="">— Yok —</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.city})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Galeri Adı (kayıtsız)</label>
            <input
              type="text" value={form.galleryName}
              onChange={(e) => setForm({ ...form, galleryName: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Şehir *</label>
            <input
              type="text" required value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">İletişim Kişisi</label>
            <input
              type="text" value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Durum</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ziyaret Tarihi *</label>
            <input
              type="date" required value={form.visitDate}
              onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="text-xs text-muted-foreground">Notlar</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded">
              İptal
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded">
              Kaydet
            </button>
          </div>
        </form>
      )}

      {/* Kanban tarzı sütunlar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {Object.entries(STATUS_LABELS).map(([statusKey, statusLabel]) => (
          <div key={statusKey} className="bg-muted/30 rounded p-3 min-h-48">
            <h3 className="text-xs font-semibold uppercase mb-2 flex justify-between">
              <span>{statusLabel}</span>
              <span className="text-muted-foreground">{grouped[statusKey].length}</span>
            </h3>
            <div className="space-y-2">
              {grouped[statusKey].map((v) => (
                <div key={v.id} className="bg-card border rounded p-2 text-xs">
                  <p className="font-medium">
                    {v.dealerName || v.galleryName || '—'}
                  </p>
                  <p className="text-muted-foreground">{v.city}</p>
                  <p className="text-muted-foreground">
                    {new Date(v.visitDate).toLocaleDateString('tr-TR')}
                  </p>
                  {v.contactName && (
                    <p className="text-muted-foreground">İletişim: {v.contactName}</p>
                  )}
                  {v.notes && (
                    <p className="mt-1 text-muted-foreground line-clamp-2">{v.notes}</p>
                  )}
                  <select
                    value={v.status}
                    onChange={(e) => updateStatus(v.id, e.target.value)}
                    className="w-full mt-2 px-1 py-1 text-xs border rounded bg-background"
                  >
                    {Object.entries(STATUS_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>{lbl}</option>
                    ))}
                  </select>
                </div>
              ))}
              {grouped[statusKey].length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Boş</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
