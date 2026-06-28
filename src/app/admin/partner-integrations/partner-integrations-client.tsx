'use client'

import { useState } from 'react'

interface Negotiation {
  id: string
  companyName: string
  adapterKey: string | null
  status: string
  contactName: string | null
  contactInfo: string | null
  notes: string | null
  lastContactDate: string | null
  createdAt: string
  updatedAt: string
}

interface Partner {
  adapterKey: string
  companyName: string
  adapterStatus: string
  adapterNote: string | null
  deepLinkBaseUrl: string | null
  negotiation: Negotiation | null
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Başlanmadı',
  in_negotiation: 'Görüşülüyor',
  agreement_signed: 'Anlaşma İmzalandı',
  integration_active: 'Entegrasyon Aktif',
  rejected: 'Reddedildi',
}

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-800',
  in_negotiation: 'bg-yellow-100 text-yellow-800',
  agreement_signed: 'bg-blue-100 text-blue-800',
  integration_active: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const ADAPTER_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  planned: 'bg-blue-100 text-blue-800',
  blocked: 'bg-red-100 text-red-800',
  unreachable: 'bg-yellow-100 text-yellow-800',
}

export default function PartnerIntegrationsClient({
  initialPartners,
  initialOrphans,
}: {
  initialPartners: Partner[]
  initialOrphans: Negotiation[]
}) {
  const [partners, setPartners] = useState(initialPartners)
  const [orphans, setOrphans] = useState(initialOrphans)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({
    status: 'not_started', contactName: '', contactInfo: '', notes: '',
    lastContactDate: new Date().toISOString().split('T')[0],
  })

  const startEdit = (negotiation: Negotiation) => {
    setForm({
      status: negotiation.status,
      contactName: negotiation.contactName || '',
      contactInfo: negotiation.contactInfo || '',
      notes: negotiation.notes || '',
      lastContactDate: negotiation.lastContactDate ? negotiation.lastContactDate.split('T')[0] : '',
    })
    setEditing(negotiation.id)
  }

  const createNew = async (adapterKey: string, companyName: string) => {
    const res = await fetch('/api/admin/partner-integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapterKey, companyName, status: 'not_started' }),
    })
    if (res.ok) {
      const data = await res.json()
      setPartners((prev) =>
        prev.map((p) =>
          p.adapterKey === adapterKey
            ? {
                ...p,
                negotiation: {
                  ...data.negotiation,
                  lastContactDate: data.negotiation.lastContactDate
                    ? new Date(data.negotiation.lastContactDate).toISOString()
                    : null,
                  createdAt: new Date(data.negotiation.createdAt).toISOString(),
                  updatedAt: new Date(data.negotiation.updatedAt).toISOString(),
                },
              }
            : p,
        ),
      )
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const res = await fetch('/api/admin/partner-integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing,
        status: form.status,
        contactName: form.contactName || null,
        contactInfo: form.contactInfo || null,
        notes: form.notes || null,
        lastContactDate: form.lastContactDate || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const updated = data.negotiation
      setPartners((prev) =>
        prev.map((p) =>
          p.negotiation?.id === editing
            ? {
                ...p,
                negotiation: {
                  ...updated,
                  lastContactDate: updated.lastContactDate
                    ? new Date(updated.lastContactDate).toISOString()
                    : null,
                  createdAt: new Date(updated.createdAt).toISOString(),
                  updatedAt: new Date(updated.updatedAt).toISOString(),
                },
              }
            : p,
        ),
      )
      setOrphans((prev) =>
        prev.map((o) => (o.id === editing ? {
          ...updated,
          lastContactDate: updated.lastContactDate ? new Date(updated.lastContactDate).toISOString() : null,
          createdAt: new Date(updated.createdAt).toISOString(),
          updatedAt: new Date(updated.updatedAt).toISOString(),
        } : o)),
      )
      setEditing(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Adaptör + Görüşme tablosu */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Adaptör ve Görüşme Durumları</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Firma</th>
                <th className="p-2 text-left">Adaptör Durumu</th>
                <th className="p-2 text-left">Görüşme Durumu</th>
                <th className="p-2 text-left">İletişim</th>
                <th className="p-2 text-left">Son İletişim</th>
                <th className="p-2 text-left">Notlar</th>
                <th className="p-2 text-left">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.adapterKey} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-2 font-medium">{p.companyName}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${ADAPTER_STATUS_COLORS[p.adapterStatus] || ''}`}>
                      {p.adapterStatus}
                    </span>
                  </td>
                  <td className="p-2">
                    {p.negotiation ? (
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[p.negotiation.status] || ''}`}>
                        {STATUS_LABELS[p.negotiation.status] || p.negotiation.status}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Kayıt yok</span>
                    )}
                  </td>
                  <td className="p-2 text-xs">
                    {p.negotiation?.contactName || '—'}
                    {p.negotiation?.contactInfo && (
                      <p className="text-muted-foreground">{p.negotiation.contactInfo}</p>
                    )}
                  </td>
                  <td className="p-2 text-xs">
                    {p.negotiation?.lastContactDate
                      ? new Date(p.negotiation.lastContactDate).toLocaleDateString('tr-TR')
                      : '—'}
                  </td>
                  <td className="p-2 text-xs max-w-xs truncate">
                    {p.negotiation?.notes || p.adapterNote || '—'}
                  </td>
                  <td className="p-2">
                    {p.negotiation ? (
                      <button
                        onClick={() => startEdit(p.negotiation)}
                        className="text-xs text-primary hover:underline"
                      >
                        Düzenle
                      </button>
                    ) : (
                      <button
                        onClick={() => createNew(p.adapterKey, p.companyName)}
                        className="text-xs text-primary hover:underline"
                      >
                        + Görüşme Başlat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit form */}
      {editing && (
        <form onSubmit={submit} className="bg-card border rounded-lg p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
          <h3 className="text-sm font-semibold col-span-full">Görüşmeyi Güncelle</h3>
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
            <label className="text-xs text-muted-foreground">İletişim Kişisi</label>
            <input
              type="text" value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">İletişim Bilgisi</label>
            <input
              type="text" value={form.contactInfo}
              onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Son İletişim Tarihi</label>
            <input
              type="date" value={form.lastContactDate}
              onChange={(e) => setForm({ ...form, lastContactDate: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="text-xs text-muted-foreground">Notlar</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
            />
          </div>
          <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm border rounded">
              İptal
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded">
              Kaydet
            </button>
          </div>
        </form>
      )}

      {/* Orphans (adapter'ı olmayan negotiations) */}
      {orphans.length > 0 && (
        <section className="bg-card border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">Adaptörle Eşleşmeyen Görüşmeler</h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Firma</th>
                <th className="p-2 text-left">Durum</th>
                <th className="p-2 text-left">Son İletişim</th>
                <th className="p-2 text-left">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {orphans.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="p-2">{o.companyName}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[o.status] || ''}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className="p-2 text-xs">
                    {o.lastContactDate ? new Date(o.lastContactDate).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => startEdit(o)}
                      className="text-xs text-primary hover:underline"
                    >
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
