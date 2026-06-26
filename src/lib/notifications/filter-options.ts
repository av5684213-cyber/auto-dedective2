// ── Filtre seçenekleri — UI ve API için sabit liste ──────────────────────
//
// Bu sabitler UI'da dropdown olarak gösterilir, alarm kurma ekranında kullanılır.
// matcher.ts'den ayrı tutuldu çünkü client component'ler (AlertManager) bunu import eder
// ve matcher.ts web-push import ettiği için client bundle'a giremez.

export const FILTER_OPTIONS = {
  yakit: ['Benzin', 'Dizel', 'LPG', 'Benzin + LPG', 'Hibrit', 'Elektrik', 'Plug-in Hibrit'],
  vites: ['Manuel', 'Otomatik', 'Yarı Otomatik', 'DSG', 'CVT'],
  kasa: ['Sedan', 'Hatchback', 'SUV', 'Station Wagon', 'Coupe', 'Cabrio', 'MPV', 'Minivan', 'Pickup', 'Crossover'],
  renk: ['Beyaz', 'Siyah', 'Gri', 'Gümüş', 'Kırmızı', 'Mavi', 'Yeşil', 'Sarı', 'Turuncu', 'Mor', 'Kahverengi', 'Bej', 'Bordo', 'Lacivert', 'Füme', 'Yeşil Metalik', 'Mavi Metalik'],
  sehir: [
    'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep',
    'Mersin', 'Kayseri', 'Şanlıurfa', 'Kocaeli', 'Sakarya', 'Trabzon', 'Eskişehir',
    'Denizli', 'Samsun', 'Balıkesir', 'Kahramanmaraş', 'Aydın', 'Hatay', 'Tekirdağ',
    'Manisa', 'Muğla', 'Ordu', 'Afyonkarahisar', 'Çorum', 'Edirne', 'Bolu',
    'Kütahya', 'Isparta', 'Uşak', 'Amasya', 'Kırıkkale', 'Karaman', 'Aksaray', 'Niğde',
    'Nevşehir', 'Kırşehir', 'Yozgat', 'Tokat', 'Sivas', 'Malatya', 'Elazığ', 'Van',
    'Diyarbakır', 'Batman', 'Siirt', 'Şırnak', 'Mardin', 'Adıyaman', 'Kilis', 'Osmaniye',
    'Zonguldak', 'Bartın', 'Karabük', 'Düzce', 'Çankırı', 'Kastamonu', 'Sinop', 'Giresun',
    'Gümüşhane', 'Bayburt', 'Erzurum', 'Erzincan', 'Ağrı', 'Kars', 'Ardahan', 'Iğdır',
    'Muş', 'Bitlis', 'Hakkari', 'Yalova', 'Burdur'
  ],
  kazali: [
    { value: 'kazasiz', label: 'Kazasız / Boyasız' },
    { value: 'az_hasarli', label: 'Az Hasarlı (1-2 parça boyalı)' },
    { value: 'orta_hasarli', label: 'Orta Hasarlı (3-5 parça boyalı/değişen)' },
    { value: 'agir_hasarli', label: 'Ağır Hasarlı (pert kaydı, çok değişen)' },
    { value: 'belirsiz', label: 'Belirsiz (ilan açıklamasında bilgi yok)' },
  ],
  firsat: ['Harika Fırsat', 'İyi Fiyat', 'Ortalama', 'Pahalı', 'Değerlendirilemedi'],
  satici: ['Galeri', 'Sahibinden', 'Bayi', 'Komisyoncu'],
  dealScoreMin: [
    { value: 5, label: '5 Yıldız — Harika Fırsat' },
    { value: 4, label: '4+ Yıldız — İyi Fiyat' },
    { value: 3, label: '3+ Yıldız — Ortalama' },
    { value: 2, label: '2+ Yıldız — Kabul Edilebilir' },
    { value: 1, label: '1+ Yıldız — Tümü' },
  ],
} as const

export type FilterOptions = typeof FILTER_OPTIONS
