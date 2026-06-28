'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Dealer {
  id: string
  name: string
  city: string
  phone: string
  email: string | null
  subscriptionPlan: string
  subscriptionPrice: number | null
  subscriptionStatus: string
  lastPaymentDate: string | null
  nextPaymentDue: string | null
  activeListingCount: number
  totalListingCount: number
}

const PLAN_LABELS: Record<string, string> = {
  none: 'Yok',
  founder: 'Kurucu Üye',
  standard: 'Standart',
  premium: 'Premium',
}

const STATUS_COLORS: Record<string, string> = {
  inactive: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function DealersManager({ initialDealers }: { initialDealers: Dealer[] }) {
  const router = useRouter()
  const [dealers, setDealers] = useState(initialDealers)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    name: '', city: '', phone: '', email: '',
    subscriptionPlan: 'none', subscriptionStatus: 'inactive',
    subscriptionPrice: '', lastPaymentDate: '', nextPaymentDue: '',
  })

  const resetForm = () => {
    setForm({
      name: '', city: '', phone: '', email: '',
      subscriptionPlan: 'none', subscriptionStatus: 'inactive',
      subscriptionPrice: '', lastPaymentDate: '', nextPaymentDue: '',
    })
    setEditing(null)
    setShowForm(false)
  }

  const startEdit = (d: Dealer) => {
    setForm({
      name: d.name,
      city: d.city,
      phone: d.phone,
      email: d.email || '',
      subscriptionPlan: d.subscriptionPlan,
      subscriptionStatus: d.subscriptionStatus,
      subscriptionPrice: d.subscriptionPrice?.toString() || '',
      lastPaymentDate: d.lastPaymentDate ? d.lastPaymentDate.split('T')[0] : '',
      nextPaymentDue: d.nextPaymentDue ? d.nextPaymentDue.split('T')[0] : '',
    })
    setEditing(d.id)
    setShowForm(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      city: form.city,
      phone: form.phone,
      email: form.email || null,
      subscriptionPlan: form.subscriptionPlan,
      subscriptionStatus: form.subscriptionStatus,
      subscriptionPrice: form.subscriptionPrice ? Number(form.subscriptionPrice) : null,
      lastPaymentDate: form.lastPaymentDate || null,
      nextPaymentDue: form.nextPaymentDue || null,
    }

    if (editing) {
      // Update
      const res = await fetch(`/api/admin/dealers/${editing}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        setDealers((prev) =>
          prev.map((d) => (d.id === editing ? { ...d, ...payload } : d)),
        )
        resetForm()
      }
    } else {
      // Create
      const res = await fetch('/api/admin/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        router.refresh()
        resetForm()
      }
    }
  }

  return (
    <div>
      {/* Üst bar */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/dealers')}
            className="px-3 py-1.5 text-sm border rounded bg-card"
          >
            Tümü
          </button>
          <button
            onClick={() => router.push('/admin/dealers?overdue=1')}
            className="px-3 py-1.5 text-sm border rounded bg-red-50 text-red-700 border-red-200"
          >
            ⚠ Ödemesi Gecikenler
          </button>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded"
        >
          + Yeni Galeri
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-card border rounded-lg p-5 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">İsim *</label>
            <input
              type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            <label className="text-xs text-muted-foreground">Telefon *</label>
            <input
              type="text" required value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <input
              type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Abonelik Planı</label>
            <select
              value={form.subscriptionPlan}
              onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            >
              <option value="none">Yok</option>
              <option value="founder">Kurucu Üye</option>
              <option value="standard">Standart</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Abonelik Durumu</label>
            <select
              value={form.subscriptionStatus}
              onChange={(e) => setForm({ ...form, subscriptionStatus: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            >
              <option value="inactive">Inactive</option>
              <option value="active">Active</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Abonelik Fiyatı (₺)</label>
            <input
              type="number" value={form.subscriptionPrice}
              onChange={(e) => setForm({ ...form, subscriptionPrice: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Son Ödeme Tarihi</label>
            <input
              type="date" value={form.lastPaymentDate}
              onChange={(e) => setForm({ ...form, lastPaymentDate: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sonraki Ödeme Tarihi</label>
            <input
              type="date" value={form.nextPaymentDue}
              onChange={(e) => setForm({ ...form, nextPaymentDue: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="px-4 py-2 text-sm border rounded">
              İptal
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded">
              {editing ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      )}

      {/* Tablo */}
      <div className="overflow-x-auto border rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 text-left">İsim</th>
              <th className="p-3 text-left">Şehir</th>
              <th className="p-3 text-left">Telefon</th>
              <th className="p-3 text-left">Plan</th>
              <th className="p-3 text-left">Durum</th>
              <th className="p-3 text-left">Son Ödeme</th>
              <th className="p-3 text-left">Sonraki Ödeme</th>
              <th className="p-3 text-right">Aktif İlan</th>
              <th className="p-3 text-left">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {dealers.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Galeri bulunamadı.
                </td>
              </tr>
            ) : (
              dealers.map((d) => {
                const isOverdue = d.subscriptionStatus === 'active' && d.nextPaymentDue && new Date(d.nextPaymentDue) < new Date()
                return (
                  <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/30 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <td className="p-3 font-medium">{d.name}</td>
                    <td className="p-3">{d.city}</td>
                    <td className="p-3 font-mono text-xs">{d.phone}</td>
                    <td className="p-3 text-xs">{PLAN_LABELS[d.subscriptionPlan] || d.subscriptionPlan}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[d.subscriptionStatus] || ''}`}>
                        {d.subscriptionStatus}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {d.lastPaymentDate ? new Date(d.lastPaymentDate).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td className="p-3 text-xs">
                      {d.nextPaymentDue ? (
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {new Date(d.nextPaymentDue).toLocaleDateString('tr-TR')}
                          {isOverdue && ' ⚠'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-right text-xs">
                      {d.activeListingCount} / {d.totalListingCount}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => startEdit(d)}
                        className="text-xs text-primary hover:underline"
                      >
                        Düzenle
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
