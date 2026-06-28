// ── Admin: Raporlar (TÜM VERİ MOCK) ───────────────────────────────────────
//
// BU SAYFA TAMAMEN MOCK VERİ GÖSTERİR. Gerçek veritabanı sorgusu YAPILMAZ.
// Veri kaynağı: src/lib/mock/reports-mock-data.ts
// Bu modül kolayca kaldırılabilir — ileride gerçek veriye bağlanabilir.

import {
  MOCK_DAILY_TRAFFIC,
  MOCK_WEEKLY_TRAFFIC,
  MOCK_TOP_MAKES,
  MOCK_TOP_MODELS,
  MOCK_DEVICE_DISTRIBUTION,
  MOCK_CITY_TRAFFIC,
  MOCK_CONVERSION_FUNNEL,
} from '@/lib/mock/reports-mock-data'

export default function ReportsPage() {
  const maxDaily = Math.max(...MOCK_DAILY_TRAFFIC.map((d) => d.visitors))
  const maxWeekly = Math.max(...MOCK_WEEKLY_TRAFFIC.map((w) => w.visitors))
  const maxMake = Math.max(...MOCK_TOP_MAKES.map((m) => m.searchCount))
  const maxFunnel = MOCK_CONVERSION_FUNNEL[0].count

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Raporlar</h1>
        <p className="text-sm text-muted-foreground">
          <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs mr-2">
            MOCK VERİ
          </span>
          Bu sayfa örnek veri gösterir. Gerçek veriye bağlanmadı.
        </p>
      </header>

      {/* Günlük trafik */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Günlük Trafik (Son 14 Gün)</h2>
        <div className="space-y-1">
          {MOCK_DAILY_TRAFFIC.map((d) => {
            const w = (d.visitors / maxDaily) * 100
            return (
              <div key={d.date} className="flex items-center gap-3 text-xs">
                <span className="w-24 text-muted-foreground">{d.date}</span>
                <div className="flex-1 bg-muted/30 rounded h-5 overflow-hidden">
                  <div
                    className="bg-primary h-full flex items-center justify-end pr-2 text-primary-foreground"
                    style={{ width: `${Math.max(w, 3)}%` }}
                  >
                    {d.visitors}
                  </div>
                </div>
                <span className="w-20 text-muted-foreground text-right">{d.pageViews} PV</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Haftalık trafik */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Haftalık Trafik (Son 8 Hafta)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MOCK_WEEKLY_TRAFFIC.map((w) => (
            <div key={w.week} className="bg-muted/30 p-3 rounded">
              <p className="text-xs text-muted-foreground">{w.week}</p>
              <p className="text-xl font-bold">{w.visitors.toLocaleString('tr-TR')}</p>
              <p className="text-xs text-muted-foreground">{w.pageViews.toLocaleString('tr-TR')} PV</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* En çok aranan markalar */}
        <section className="bg-card border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">En Çok Aranan Markalar</h2>
          <div className="space-y-2">
            {MOCK_TOP_MAKES.map((m) => {
              const w = (m.searchCount / maxMake) * 100
              return (
                <div key={m.make} className="flex items-center gap-2 text-xs">
                  <span className="w-28">{m.make}</span>
                  <div className="flex-1 bg-muted/30 rounded h-4 overflow-hidden">
                    <div
                      className="bg-orange-500 h-full"
                      style={{ width: `${Math.max(w, 2)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-muted-foreground">
                    {m.searchCount.toLocaleString('tr-TR')} (%{m.percentage})
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* En çok aranan modeller */}
        <section className="bg-card border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">En Çok Aranan Modeller</h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Model</th>
                <th className="p-2 text-left">Marka</th>
                <th className="p-2 text-right">Arama</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TOP_MODELS.map((m) => (
                <tr key={m.model + m.make} className="border-b last:border-0">
                  <td className="p-2">{m.model}</td>
                  <td className="p-2 text-xs text-muted-foreground">{m.make}</td>
                  <td className="p-2 text-right text-xs">{m.searchCount.toLocaleString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cihaz dağılımı */}
        <section className="bg-card border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">Cihaz Dağılımı</h2>
          <div className="space-y-2">
            {MOCK_DEVICE_DISTRIBUTION.map((d) => (
              <div key={d.device} className="flex items-center gap-2 text-sm">
                <span className="w-20">{d.device}</span>
                <div className="flex-1 bg-muted/30 rounded h-6 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full flex items-center justify-end pr-2 text-xs text-white"
                    style={{ width: `${d.percentage}%` }}
                  >
                    %{d.percentage}
                  </div>
                </div>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {d.count.toLocaleString('tr-TR')}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Şehir bazlı */}
        <section className="bg-card border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">Şehir Bazlı Trafik</h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Şehir</th>
                <th className="p-2 text-right">Ziyaretçi</th>
                <th className="p-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CITY_TRAFFIC.map((c) => (
                <tr key={c.city} className="border-b last:border-0">
                  <td className="p-2">{c.city}</td>
                  <td className="p-2 text-right text-xs">{c.visitors.toLocaleString('tr-TR')}</td>
                  <td className="p-2 text-right text-xs text-muted-foreground">%{c.percentage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Dönüşüm hunisi */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Dönüşüm Hunisi</h2>
        <div className="space-y-2">
          {MOCK_CONVERSION_FUNNEL.map((s, i) => {
            const w = (s.count / maxFunnel) * 100
            const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-teal-500', 'bg-amber-500', 'bg-orange-500']
            return (
              <div key={s.stage} className="flex items-center gap-3 text-sm">
                <span className="w-40">{s.stage}</span>
                <div className="flex-1 bg-muted/30 rounded h-8 overflow-hidden">
                  <div
                    className={`${colors[i]} h-full flex items-center justify-end pr-3 text-xs text-white`}
                    style={{ width: `${Math.max(w, 5)}%` }}
                  >
                    {s.count.toLocaleString('tr-TR')} (%{s.percentage})
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
