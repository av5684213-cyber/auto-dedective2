import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import LeadDetailClient from './lead-detail-client'

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true, make: true, model: true, year: true, price: true,
          sourceName: true, city: true, imageUrl: true, sourceUrl: true,
        },
      },
      notes: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!lead) notFound()

  return (
    <div className="p-6">
      <Link href="/admin/leads" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        ← Taleplere dön
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Talep bilgisi */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border rounded-lg p-5">
            <h1 className="text-xl font-bold mb-3">{lead.name}</h1>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Telefon</p>
                <p className="font-mono">{lead.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p>{lead.email || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Oluşturulma</p>
                <p>{new Date(lead.createdAt).toLocaleString('tr-TR')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Son Güncelleme</p>
                <p>{new Date(lead.updatedAt).toLocaleString('tr-TR')}</p>
              </div>
            </div>
            {lead.message && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-muted-foreground text-sm mb-1">Mesaj</p>
                <p className="text-sm">{lead.message}</p>
              </div>
            )}
          </div>

          {/* İlgili ilan */}
          {lead.listing && (
            <div className="bg-card border rounded-lg p-5">
              <h2 className="text-sm font-semibold mb-3">İlgili İlan</h2>
              <Link
                href={`/ilan/${lead.listing.id}`}
                target="_blank"
                className="flex gap-3 items-center hover:bg-accent p-2 rounded"
              >
                {lead.listing.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lead.listing.imageUrl}
                    alt=""
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div>
                  <p className="font-medium">{lead.listing.make} {lead.listing.model}</p>
                  <p className="text-sm text-muted-foreground">
                    {lead.listing.year} • {(lead.listing.price || 0).toLocaleString('tr-TR')} ₺
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lead.listing.sourceName} • {lead.listing.city || '—'}
                  </p>
                </div>
              </Link>
            </div>
          )}

          {/* Notlar */}
          <LeadDetailClient leadId={lead.id} initialNotes={lead.notes} />
        </div>

        {/* Sağ: Durum güncelleme */}
        <div className="space-y-4">
          <div className="bg-card border rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-3">Durum</h2>
            <LeadStatusUpdater leadId={lead.id} currentStatus={lead.status} />
          </div>
        </div>
      </div>
    </div>
  )
}
