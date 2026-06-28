import { db } from '@/lib/db'
import Link from 'next/link'

// ── Admin: Müşteri Talepleri (Leads) ──────────────────────────────────────

const STATUSES = [
  { value: 'all', label: 'Tümü' },
  { value: 'new', label: 'Yeni' },
  { value: 'contacted', label: 'İletişim Kuruldu' },
  { value: 'interested', label: 'İlgili' },
  { value: 'no_response', label: 'Yanıt Yok' },
  { value: 'converted', label: 'Dönüştü' },
  { value: 'lost', label: 'Kayıp' },
] as const

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  interested: 'bg-green-100 text-green-800',
  no_response: 'bg-gray-100 text-gray-800',
  converted: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-800',
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const status = params.status || 'all'

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.status = status

  const leads = await db.lead.findMany({
    where,
    include: {
      listing: { select: { id: true, make: true, model: true, year: true, price: true } },
      notes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Müşteri Talepleri</h1>
        <p className="text-sm text-muted-foreground">
          İlanlarla ilgili gelen taleplerin yönetimi.
        </p>
      </header>

      {/* Filtre */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/leads?status=${s.value}`}
            className={`px-3 py-1.5 text-sm rounded-md border ${
              status === s.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card hover:bg-accent'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto border rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 text-left">İsim</th>
              <th className="p-3 text-left">Telefon</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">İlgili İlan</th>
              <th className="p-3 text-left">Mesaj</th>
              <th className="p-3 text-left">Durum</th>
              <th className="p-3 text-left">Tarih</th>
              <th className="p-3 text-left">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Bu durumda talep bulunamadı.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{lead.name}</td>
                  <td className="p-3 font-mono text-xs">{lead.phone}</td>
                  <td className="p-3 text-xs">{lead.email || '—'}</td>
                  <td className="p-3 text-xs">
                    {lead.listing ? (
                      <Link
                        href={`/ilan/${lead.listing.id}`}
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        {lead.listing.make} {lead.listing.model} ({lead.listing.year})
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3 text-xs max-w-xs truncate">
                    {lead.message || '—'}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[lead.status] || ''}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {new Date(lead.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="p-3 text-xs">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="text-primary hover:underline"
                    >
                      Detay →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
