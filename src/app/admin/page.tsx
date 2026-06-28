import Link from 'next/link'
import { db } from '@/lib/db'

// ── Admin ana sayfa — modül özet kartları ────────────────────────────────

export default async function AdminHomePage() {
  const [
    totalLeads, newLeads, totalListings, matchedListings, manualReviewListings,
    totalDealers, activeDealers, overdueDealers, totalVisits, signedVisits,
    totalNegotiations, activeIntegrations, totalSavedSearches, totalNotifications,
  ] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { status: 'new' } }),
    db.listing.count({ where: { isActive: true, isDeleted: false } }),
    db.listing.count({ where: { matchStatus: 'matched' } }),
    db.listing.count({ where: { matchStatus: 'manual_review' } }),
    db.dealer.count(),
    db.dealer.count({ where: { subscriptionStatus: 'active' } }),
    db.dealer.count({
      where: {
        subscriptionStatus: 'active',
        nextPaymentDue: { lt: new Date() },
      },
    }),
    db.salesVisit.count(),
    db.salesVisit.count({ where: { status: 'signed' } }),
    db.partnerNegotiation.count(),
    db.partnerNegotiation.count({ where: { status: 'integration_active' } }),
    db.savedSearch.count({ where: { isActive: true } }),
    db.alertNotification.count(),
  ])

  const cards = [
    {
      href: '/admin/leads',
      title: 'Müşteri Talepleri',
      stats: [
        { label: 'Toplam', value: totalLeads },
        { label: 'Yeni', value: newLeads, highlight: newLeads > 0 },
      ],
      icon: '📞',
    },
    {
      href: '/admin/listings',
      title: 'İlan Yönetimi',
      stats: [
        { label: 'Aktif', value: totalListings },
        { label: 'Matched', value: matchedListings },
        { label: 'İncelenecek', value: manualReviewListings, highlight: manualReviewListings > 0 },
      ],
      icon: '🚗',
    },
    {
      href: '/admin/dealers',
      title: 'Esnaf/Galeri',
      stats: [
        { label: 'Toplam', value: totalDealers },
        { label: 'Aktif', value: activeDealers },
        { label: 'Geciken', value: overdueDealers, highlight: overdueDealers > 0 },
      ],
      icon: '🏪',
    },
    {
      href: '/admin/data-quality',
      title: 'Veri Kalitesi',
      stats: [
        { label: 'Aktif İlan', value: totalListings },
        { label: 'Matched', value: matchedListings },
        { label: 'İncelenecek', value: manualReviewListings },
      ],
      icon: '📊',
    },
    {
      href: '/admin/sales-pipeline',
      title: 'Saha Satış',
      stats: [
        { label: 'Ziyaret', value: totalVisits },
        { label: 'Anlaşma', value: signedVisits },
      ],
      icon: '🤝',
    },
    {
      href: '/admin/partner-integrations',
      title: 'Kurumsal Entegrasyon',
      stats: [
        { label: 'Görüşme', value: totalNegotiations },
        { label: 'Aktif', value: activeIntegrations },
      ],
      icon: '🏢',
    },
    {
      href: '/admin/alerts-monitoring',
      title: 'Bildirim İzleme',
      stats: [
        { label: 'Kayıtlı Arama', value: totalSavedSearches },
        { label: 'Bildirim', value: totalNotifications },
      ],
      icon: '🔔',
    },
    {
      href: '/admin/reports',
      title: 'Raporlar',
      stats: [{ label: 'Mock Veri', value: 0 }],
      icon: '📈',
    },
  ]

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Admin Paneli</h1>
        <p className="text-sm text-muted-foreground">
          Otodedektif yönetim paneli — genel durum özeti.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-card border rounded-lg p-5 hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <h2 className="text-sm font-semibold mb-3">{card.title}</h2>
            <div className="space-y-1">
              {card.stats.map((s) => (
                <div key={s.label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className={`font-bold ${s.highlight ? 'text-red-600' : ''}`}>
                    {s.value.toLocaleString('tr-TR')}
                  </span>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
