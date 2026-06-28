// ── Mock raporlama verisi ────────────────────────────────────────────────
//
// BU DOSYA TAMAMEN MOCK VERİ İÇERİR — gerçek veritabanı sorgusu YAPILMAZ.
// İleride gerçek veriye bağlanmak istenirse, bu dosya silinir ve API route
// gerçek sorgularla değiştirilir. Bu modül kolayca kaldırılabilir.

// Günlük trafik verisi (son 14 gün)
export const MOCK_DAILY_TRAFFIC = [
  { date: '2026-06-14', visitors: 1240, pageViews: 3850, uniqueVisitors: 980 },
  { date: '2026-06-15', visitors: 1380, pageViews: 4120, uniqueVisitors: 1090 },
  { date: '2026-06-16', visitors: 1190, pageViews: 3680, uniqueVisitors: 940 },
  { date: '2026-06-17', visitors: 1520, pageViews: 4580, uniqueVisitors: 1210 },
  { date: '2026-06-18', visitors: 1640, pageViews: 4920, uniqueVisitors: 1320 },
  { date: '2026-06-19', visitors: 1450, pageViews: 4380, uniqueVisitors: 1150 },
  { date: '2026-06-20', visitors: 1680, pageViews: 5100, uniqueVisitors: 1340 },
  { date: '2026-06-21', visitors: 1820, pageViews: 5520, uniqueVisitors: 1450 },
  { date: '2026-06-22', visitors: 1750, pageViews: 5280, uniqueVisitors: 1390 },
  { date: '2026-06-23', visitors: 1920, pageViews: 5840, uniqueVisitors: 1530 },
  { date: '2026-06-24', visitors: 2050, pageViews: 6210, uniqueVisitors: 1640 },
  { date: '2026-06-25', visitors: 2180, pageViews: 6580, uniqueVisitors: 1740 },
  { date: '2026-06-26', visitors: 1980, pageViews: 5990, uniqueVisitors: 1580 },
  { date: '2026-06-27', visitors: 2240, pageViews: 6790, uniqueVisitors: 1790 },
]

// Haftalık trafik özeti (son 8 hafta)
export const MOCK_WEEKLY_TRAFFIC = [
  { week: '2026-W11', visitors: 8240, pageViews: 24800 },
  { week: '2026-W12', visitors: 8680, pageViews: 26100 },
  { week: '2026-W13', visitors: 9120, pageViews: 27450 },
  { week: '2026-W14', visitors: 9540, pageViews: 28700 },
  { week: '2026-W15', visitors: 9980, pageViews: 30050 },
  { week: '2026-W16', visitors: 10420, pageViews: 31380 },
  { week: '2026-W17', visitors: 10850, pageViews: 32640 },
  { week: '2026-W18', visitors: 11320, pageViews: 34120 },
]

// En çok aranan markalar
export const MOCK_TOP_MAKES = [
  { make: 'Volkswagen', searchCount: 4520, percentage: 14.2 },
  { make: 'Renault', searchCount: 4180, percentage: 13.1 },
  { make: 'BMW', searchCount: 3540, percentage: 11.1 },
  { make: 'Ford', searchCount: 3210, percentage: 10.1 },
  { make: 'Fiat', searchCount: 2980, percentage: 9.4 },
  { make: 'Mercedes-Benz', searchCount: 2760, percentage: 8.7 },
  { make: 'Audi', searchCount: 2340, percentage: 7.4 },
  { make: 'Opel', searchCount: 2120, percentage: 6.7 },
  { make: 'Toyota', searchCount: 1840, percentage: 5.8 },
  { make: 'Peugeot', searchCount: 1680, percentage: 5.3 },
  { make: 'Skoda', searchCount: 1520, percentage: 4.8 },
  { make: 'Hyundai', searchCount: 1380, percentage: 4.3 },
]

// En çok aranan modeller
export const MOCK_TOP_MODELS = [
  { model: 'Golf', make: 'Volkswagen', searchCount: 1240 },
  { model: 'Megane', make: 'Renault', searchCount: 1180 },
  { model: 'Passat', make: 'Volkswagen', searchCount: 980 },
  { model: '3 Serisi', make: 'BMW', searchCount: 920 },
  { model: 'Astra', make: 'Opel', searchCount: 870 },
  { model: 'Focus', make: 'Ford', searchCount: 820 },
  { model: 'Clio', make: 'Renault', searchCount: 780 },
  { model: 'A3', make: 'Audi', searchCount: 740 },
  { model: 'Egea', make: 'Fiat', searchCount: 720 },
  { model: 'Corolla', make: 'Toyota', searchCount: 690 },
]

// Cihaz dağılımı
export const MOCK_DEVICE_DISTRIBUTION = [
  { device: 'Mobil', count: 18720, percentage: 67.8 },
  { device: 'Masaüstü', count: 6840, percentage: 24.8 },
  { device: 'Tablet', count: 2060, percentage: 7.4 },
]

// Şehir bazlı trafik
export const MOCK_CITY_TRAFFIC = [
  { city: 'İstanbul', visitors: 8940, percentage: 32.4 },
  { city: 'Ankara', visitors: 4520, percentage: 16.4 },
  { city: 'İzmir', visitors: 3210, percentage: 11.6 },
  { city: 'Bursa', visitors: 1840, percentage: 6.7 },
  { city: 'Antalya', visitors: 1620, percentage: 5.9 },
  { city: 'Adana', visitors: 1380, percentage: 5.0 },
  { city: 'Konya', visitors: 1240, percentage: 4.5 },
  { city: 'Gaziantep', visitors: 980, percentage: 3.6 },
  { city: 'Kayseri', visitors: 870, percentage: 3.2 },
  { city: 'Mersin', visitors: 760, percentage: 2.8 },
]

// Dönüşüm hunisi (mock)
export const MOCK_CONVERSION_FUNNEL = [
  { stage: 'Ziyaret', count: 27620, percentage: 100 },
  { stage: 'Arama', count: 18450, percentage: 66.8 },
  { stage: 'İlan Detayı', count: 9870, percentage: 35.7 },
  { stage: 'İletişim/Talep', count: 1240, percentage: 4.5 },
  { stage: 'Bayi Yönlendirme', count: 380, percentage: 1.4 },
]
