import { db } from '@/lib/db'
import { ADAPTER_STATUSES } from '@/lib/adapters'
import PartnerIntegrationsClient from './partner-integrations-client'

export default async function PartnerIntegrationsPage() {
  const negotiations = await db.partnerNegotiation.findMany({
    orderBy: { updatedAt: 'desc' },
  })

  const partners = ADAPTER_STATUSES.map((adapter) => {
    const negotiation = negotiations.find((n) => n.adapterKey === adapter.name)
    return {
      adapterKey: adapter.name,
      companyName: negotiation?.companyName || adapter.displayName,
      adapterStatus: adapter.status,
      adapterNote: adapter.note,
      deepLinkBaseUrl: adapter.deepLinkBaseUrl || null,
      negotiation: negotiation
        ? {
            ...negotiation,
            lastContactDate: negotiation.lastContactDate?.toISOString() || null,
            createdAt: negotiation.createdAt.toISOString(),
            updatedAt: negotiation.updatedAt.toISOString(),
          }
        : null,
    }
  })

  const orphans = negotiations
    .filter((n) => !ADAPTER_STATUSES.some((a) => a.name === n.adapterKey))
    .map((n) => ({
      ...n,
      lastContactDate: n.lastContactDate?.toISOString() || null,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }))

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Kurumsal Entegrasyonlar</h1>
        <p className="text-sm text-muted-foreground">
          Vavacars, Otokoç gibi kurumsal firmalarla görüşme durumları.
        </p>
      </header>

      <PartnerIntegrationsClient initialPartners={partners} initialOrphans={orphans} />
    </div>
  )
}
