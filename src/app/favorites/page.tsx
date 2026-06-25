import type { Metadata } from 'next'
import { FavoritesPanel } from '@/components/favorites-panel'

export const metadata: Metadata = {
  title: 'Favorilerim — Otodedektif',
  description: 'Kaydettiğiniz favori ilanları görün ve karşılaştırın.',
  robots: { index: false, follow: false },
}

export default function FavoritesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <a href="/" className="hover:text-foreground transition-colors">Ana sayfa</a>
            <span className="text-foreground font-medium">Favorilerim</span>
          </nav>
        </div>
      </div>
      <FavoritesPanel />
    </div>
  )
}
