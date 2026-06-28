import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminUser } from '@/lib/admin-auth'
import { Car } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin/leads', label: 'Müşteri Talepleri', icon: '📞' },
  { href: '/admin/listings', label: 'İlan Yönetimi', icon: '🚗' },
  { href: '/admin/dealers', label: 'Esnaf/Galeri Yönetimi', icon: '🏪' },
  { href: '/admin/data-quality', label: 'Veri Kalitesi', icon: '📊' },
  { href: '/admin/sales-pipeline', label: 'Saha Satış Takibi', icon: '🤝' },
  { href: '/admin/partner-integrations', label: 'Kurumsal Entegrasyonlar', icon: '🏢' },
  { href: '/admin/alerts-monitoring', label: 'Bildirim İzleme', icon: '🔔' },
  { href: '/admin/reports', label: 'Raporlar', icon: '📈' },
] as const

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAdminUser()
  if (!user) {
    redirect('/auth/login?callbackUrl=/admin')
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className="w-64 bg-card border-r flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b">
          <Link href="/admin" className="flex items-center gap-2">
            <Car className="h-6 w-6 text-orange-600" />
            <span className="text-lg font-extrabold">
              <span className="text-orange-600">Oto</span>
              <span className="text-amber-500">dedektif</span>
            </span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Admin Paneli</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{user.email}</p>
            <p className="capitalize">Rol: {user.role}</p>
          </div>
          <Link
            href="/"
            className="block px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Siteye dön
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto">
        {children}
      </main>
    </div>
  )
}
