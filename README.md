# AracıKıyas — Türkiye İkinci El Araç Meta-Arama Platformu

Türkiye'deki ikinci el araç ilanlarını 14+ platformdan toplayan, karşılaştıran ve fiyat analizi sunan meta-arama platformu.

## Mimari

```
Scheduler → Adapters → Normalize → Dedup → UPSERT → Valuator → CostEstimator → DealScorer → API (Redis Cache)
```

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM |
| Veritabanı | SQLite (geliştirme), PostgreSQL (üretim) |
| Cache | Redis (ioredis) — bellek içi önbelleğe düşer |
| Scraping | axios + cheerio |
| Zamanlayıcı | node-cron tabanlı Scheduler |

## Özellikler

- **14+ Platform Desteği**: Letgo (aktif), Sahibinden, Arabam, VavaCars, Carvak, Otokoç, DOD, Spoticar, Garenta, Avis, Sixt, Pert Dünyası, Hasarlı Araba, Taşıt.com
- **Akıllı Normalizasyon**: Türkçe marka/model/yakıt/vites/şehir normalizasyonu
- **Tekil Eşleştirme**: VIN + marka+model+yıl+km+fiyat bazlı deduplikasyon
- **Değerleme Motoru**: Karşılaştırılabilir ilan analizi, km düzeltmeli regresyon
- **Fırsat Skorlama**: Harika Fırsat / İyi Fiyat / Piyasa Fiyatı / Piyasa Üstü / Pahalı
- **Sahip Olma Maliyeti**: Depresyasyon, yakıt, sigorta, bakım, MTV hesaplaması
- **Redis Önbellek**: API yanıtlarını önbelleğe alır, Redis yoksa bellek içi önbellek kullanır
- **Zamanlayıcı**: Periyodik scraping, değerleme ve deduplikasyon

## Hızlı Başlangıç

### Gereksinimler

- Node.js 18+ veya Bun
- Redis (isteğe bağlı — yoksa bellek içi önbellek kullanılır)

### Kurulum

```bash
# Bağımlılıkları yükle
bun install

# Veritabanını oluştur
bun run db:push

# Geliştirme sunucusunu başlat
bun run dev
```

### Docker ile Başlatma

```bash
# Redis ile birlikte başlat
docker-compose up -d

# Uygulama: http://localhost:3000
# Redis: localhost:6379
```

## API Uç Noktaları

### Kullanıcı Uç Noktaları

| Metod | Yol | Açıklama |
|-------|-----|----------|
| GET | `/api/listings` | İlanları ara ve filtrele |
| GET | `/api/listings/:id` | İlan detayı + fiyat geçmişi + karşılaştırılabilirler |
| GET | `/api/listings/suggestions?q=` | Marka/model önerileri |

### Admin Uç Noktaları

| Metod | Yol | Açıklama |
|-------|-----|----------|
| POST | `/api/admin/scrape` | Scraping pipeline'ı tetikle |
| GET | `/api/admin/stats` | Platform istatistikleri |
| GET | `/api/admin/adapters` | Adaptör kayıt durumu |
| GET | `/api/admin/scheduler` | Zamanlayıcı durumu |
| POST | `/api/admin/scheduler` | Zamanlayıcıyı başlat/durdur/tetikle |

### Scraping Pipeline'ı Tetikleme

```bash
# Tüm kaynakları scrape et
curl -X POST http://localhost:3000/api/admin/scrape

# Tek kaynak scrape et
curl -X POST http://localhost:3000/api/admin/scrape \
  -H "Content-Type: application/json" \
  -d '{"sourceName": "letgo"}'

# Filtre ile scrape et
curl -X POST http://localhost:3000/api/admin/scrape \
  -H "Content-Type: application/json" \
  -d '{"sourceName": "letgo", "filters": {"make": "BMW"}}'
```

### Zamanlayıcı Yönetimi

```bash
# Zamanlayıcıyı başlat
curl -X POST http://localhost:3000/api/admin/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "intervalMs": 1800000}'

# Zamanlayıcıyı durdur
curl -X POST http://localhost:3000/api/admin/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'

# Manuel pipeline tetikle
curl -X POST http://localhost:3000/api/admin/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "trigger"}'
```

## Proje Yapısı

```
src/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── scrape/route.ts       # Scraping tetikleyici
│   │   │   ├── stats/route.ts        # İstatistikler
│   │   │   ├── adapters/route.ts     # Adaptör bilgileri
│   │   │   └── scheduler/route.ts    # Zamanlayıcı yönetimi
│   │   └── listings/
│   │       ├── route.ts              # Arama/filtreleme
│   │       ├── [id]/route.ts         # İlan detayı
│   │       └── suggestions/route.ts  # Öneriler
│   ├── page.tsx                      # Ana sayfa
│   └── layout.tsx                    # Uygulama düzeni
├── components/                       # UI bileşenleri
├── lib/
│   ├── adapters/
│   │   ├── base.ts                   # BaseAdapter sınıfı
│   │   ├── letgo.ts                  # Letgo scraper
│   │   ├── registry.ts               # Adaptör kayıt sistemi
│   │   └── index.ts                  # Adaptör yönetimi
│   ├── services/
│   │   ├── scraper.ts                # Scraping orkestratörü
│   │   ├── normalizer.ts             # Veri normalizasyonu
│   │   ├── deduplicator.ts           # Tekil eşleştirme
│   │   ├── valuator.ts               # Değerleme motoru
│   │   ├── cost-estimator.ts         # Sahip olma maliyeti
│   │   ├── scheduler.ts              # Zamanlayıcı
│   │   └── cache.ts                  # Redis/bellek önbellek
│   ├── utils/
│   │   └── rate-limiter.ts           # Hız sınırlayıcı
│   ├── constants.ts                  # Sabitler ve haritalar
│   ├── types.ts                      # TypeScript tipleri
│   └── db.ts                         # Prisma istemcisi
└── prisma/
    └── schema.prisma                 # Veritabanı şeması
```

## Ortam Değişkenleri

`.env.example` dosyasını kopyalayarak başlayın:

```bash
cp .env.example .env
```

## Lisans

Özel
