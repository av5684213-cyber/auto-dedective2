// ── Parça/Yedek Parça Filtresi v2 ────────────────────────────────────────
//
// Otomobil parçaları, aksesuarlar ve geçersiz ilanları tespit eder.
// 3 katmanlı analiz:
//   1. Anahtar kelime tespiti (model/trim/description içinde)
//   2. Fiyat eşiği (çok düşük fiyat = parça)
//   3. Geçersiz marka (parse hatası tespiti)
//   4. Skorlama sistemi — birden fazla kriter eşleşirse daha yüksek güven
//
// Kullanım:
//   - Scraper'lar: isPartOrAccessory() → true ise DB'ye yazma
//   - Temizlik bot'u: scanForParts() → DB'deki parça ilanlarını bul
//   - /api/listings: minimum fiyat eşiği (30K)

export interface ListingForFilter {
  id?: string
  make?: string
  model?: string
  trim?: string | null
  description?: string | null
  price?: number
  year?: number
  bodyType?: string | null
  fuelType?: string | null
  sourceName?: string
}

export interface PartDetectionResult {
  isPart: boolean
  confidence: number // 0-100 (yüksek = daha emin)
  reasons: string[] // tespit nedenleri
}

// ═══════════════════════════════════════════════════════════════════════════
// KATEGORİ 1: Araç Parçaları (kelime tabanlı)
// ═══════════════════════════════════════════════════════════════════════════

const PART_KEYWORDS_HIGH = [
  // Gövde parçaları
  'tampon', 'ön tampon', 'ön tanpon', 'arka tampon', 'arka tanpon',
  'çamurluk', 'camurluk', 'kanat', 'etek', 'splitter', 'difüzör', 'difuzor',
  'kapı', 'kapi', 'kaput', 'bagaj', 'tavan', 'çatı', 'cati',
  'torpido', 'gösterge', 'gosterge', 'konsol', 'el dayama',
  // Motor/Mekanik
  'motor takımı', 'motor takimi', 'çıkmış motor', 'cikmis motor',
  'çıkma motor', 'cikma motor', 'sandık motor', 'sandik motor', 'sandomotor',
  'komple motor', 'motor bloğu', 'motor blogu',
  'kafa kontör', 'kafa kontor', 'karter',
  'kam mili', 'kam mili', 'krank', 'piston', 'segman',
  // Şanzıman/Aktarma
  'şanzıman', 'sanziman', 'vites kutusu', 'aktarma', 'diferansiyel',
  'merkez', 'şaft', 'shaft',
  // Fren/Süspansiyon
  'balata', 'disk', 'kaliper', 'abs ünitesi', 'abs unite', 'abs kontrol',
  'rotil', 'amortisör', 'amortisor', 'yay', 'kelepçe', 'salıncak', 'salincak',
  // Elektrik/Elektronik
  'far', 'stop', 'sinyal', 'led', 'ampul', 'arka far', 'ön far',
  'akü', 'aku', 'bobin', 'bujü', 'buji', 'enkoder',
  'eku', 'beyin', 'yazılım', 'yazilim', 'modül', 'modul',
  'radyo', 'navigasyon', 'multimedya', 'ekran', 'display',
  // Soğutma
  'radyatör', 'radyator', 'intercooler', 'depo', 'genleşme', 'genlesme',
  // Egzoz
  'egzoz', 'egsoz', 'egkos', 'susturucu', 'katalizör', 'katalizor',
  // İç aksesuar
  'direksiyon', 'direksiyon pompası', 'direksiyon simidi',
  'koltuk', 'arabalık', 'halı', 'hali', 'koltuk kılıfı', 'koltuk kilifi',
  // Diğer
  'jant', 'lastik', 'tekerlek', 'çelik jant', 'alasaj', 'alaşım',
  'silecek', 'silenbak', 'marş motoru', 'mars motoru', 'marş', 'mars',
  'pompası', 'pompasi', 'pompa', 'demiri', 'demir', 'kapak', 'conta',
  // İngilizce
  'bumpers', 'headlight', 'taillight', 'fender', 'hood', 'trunk',
  'gearbox', 'transmission', 'engine', 'radiator', 'intercooler',
  'wing', 'wheel', 'tyre', 'tire',
]

// ═══════════════════════════════════════════════════════════════════════════
// KATEGORİ 2: Yedek Parça İfadeleri (cümle tabanlı)
// ═══════════════════════════════════════════════════════════════════════════

const PART_PHRASES = [
  'yedek parça', 'yedek parca',
  'parça olarak', 'parca olarak',
  'parça satış', 'parca satis', 'parça satışı', 'parça sat',
  'hasarlı parça', 'hasarli parca',
  'çıkma parça', 'cikma parca',
  'orijinal parça', 'orijinal parca', 'fabrikasyon parça',
  'aksesuar', 'aksesuarlar',
  'dogbox', 'winch', 'rot',
  'komple alın', 'komple alin',
  'sadece parça', 'parça halinde', 'parca halinde',
]

// ═══════════════════════════════════════════════════════════════════════════
// KATEGORİ 3: Araç Dışı Ürünler (EV charger, ekipman, vb.)
// ═══════════════════════════════════════════════════════════════════════════

const NON_VEHICLE_KEYWORDS = [
  'wallbox', 'şarj istasyonu', 'sarj istasyonu', 'şarj ünitesi', 'sarj ünitesi',
  'şarj kablosu', 'sarj kablosu', 'ev şarj', 'ev sarj',
  'sprey', 'spays', 'boya', 'cila', 'paste', 'wax',
  'kask', 'kaskı', 'kaski',
  'çadır', 'cadir', 'karavan', 'tenteli',
  'römork', 'romork', 'dorse',
  'jet ski', 'jetski', 'atv', 'utv',
  'traktör', 'traktor', 'tarım', 'tarim',
  'forklift', 'iş makinesi', 'is makinesi',
  'motosiklet ekipman', 'korumalık', 'korumalik',
  'çocuk arabası', 'cocuk arabasi', 'bebek arabası', 'bebek arabasi',
  'oyuncak araba', 'oyuncak',
  'mini araba', 'elektrikli araba', 'akülü araba', 'akulu araba',
  'battery', 'charger', 'powerbank',
]

// ═══════════════════════════════════════════════════════════════════════════
// KATEGORİ 4: Geçersiz Marka (parse hatası)
// ═══════════════════════════════════════════════════════════════════════════

const INVALID_MAKES = [
  'şanzıman', 'sanziman', 'sahibinden', 'sahibinden', 'yedek', 'parça', 'parca',
  'aksesuar', 'motor', 'galeri', 'satılık', 'satilik',
  'letgo', 'sahibinden.com', 'com', 'www', 'aracım', 'aracim',
  'araç', 'arac', 'komple', 'eksper', 'ikinci el',
  // Yıl marka olarak geçemez
  '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018',
  '2019', '2020', '2021', '2022', '2023', '2024', '2025',
  // Letgo template kelimeleri
  'sıfırından', 'sifirindan', 'uygun fiyata',
]

// ═══════════════════════════════════════════════════════════════════════════
// KATEGORİ 5: Scooter/Motosiklet (gerçek araç, parça değil)
// ═══════════════════════════════════════════════════════════════════════════

const SCOOTER_MAKES = [
  'honda activa', 'honda pcx', 'honda vision', 'honda wingo', 'honda lead',
  'yamaha nmax', 'yamaha aerox', 'yamaha xmax', 'yamaha majesty',
  'vespa', 'sym', 'kymco', 'bajaj', 'tvs', 'aprilia', 'piaggio',
  'peugeot speedfight', 'peugeot tweet', 'peugeot kisbee',
  'suzuki burgman', 'suzuki address',
  'kawasaki', 'ducati', 'ktm', 'triumph', 'bmw motorrad',
]

const SCOOTER_KEYWORDS = [
  'scooter', 'motosiklet', 'motor ', 'cc ', '125cc', '50cc', '150cc', '250cc',
  'vergisiz', 'şehir içi', 'sehir ici',
]

// En düşük geçerli araç fiyatı
const MIN_CAR_PRICE = 30000
const MIN_SCOOTER_PRICE = 8000

// ═══════════════════════════════════════════════════════════════════════════
// ANA FONKSİYON: isPartOrAccessory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * İlanın parça/yedek parça olup olmadığını kontrol eder.
 * Skorlama sistemi: her kriterin güven skoru var, toplam 50+ ise parça sayılır.
 */
export function isPartOrAccessory(listing: ListingForFilter): boolean {
  const result = analyzeListing(listing)
  return result.isPart
}

/**
 * İlanı detaylı analiz eder — hangi kriterler eşleşti, güven skoru nedir.
 */
export function analyzeListing(listing: ListingForFilter): PartDetectionResult {
  const make = (listing.make || '').toLowerCase().trim()
  const model = (listing.model || '').toLowerCase().trim()
  const trim = (listing.trim || '').toLowerCase().trim()
  const description = (listing.description || '').toLowerCase().trim()
  const price = listing.price || 0
  const combined = `${model} ${trim} ${description}`.toLowerCase()

  let confidence = 0
  const reasons: string[] = []

  // ── Kriter 1: Araç parçası kelimeleri (yüksek güven, +50) ────────────
  // "fender" gibi kelimeler "Defender" içinde yanlış eşleşmesin — kelime sınırı kontrolü
  const matchedPartKeywords = PART_KEYWORDS_HIGH.filter(kw => {
    const kwLower = kw.toLowerCase()
    if (!combined.includes(kwLower)) return false
    // Türkçe karakter normalize et
    const normalized = combined
      .replace(/İ/g, 'I').replace(/ı/g, 'i')
      .replace(/Ş/g, 'S').replace(/ş/g, 's')
      .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
      .replace(/Ü/g, 'U').replace(/ü/g, 'u')
      .replace(/Ö/g, 'O').replace(/ö/g, 'o')
      .replace(/Ç/g, 'C').replace(/ç/g, 'c')
    // İngilizce kelimeler için kelime sınırı kontrolü
    // "fender" → sadece "fender" kelimesi, "Defender" değil
    const englishWords = ['fender', 'hood', 'trunk', 'wing', 'wheel', 'tyre', 'tire', 'engine', 'radiator']
    if (englishWords.includes(kwLower)) {
      // \b kelime sınırı — önceki karakter harf değil
      const regex = new RegExp(`\\b${kwLower}\\b`, 'i')
      return regex.test(normalized)
    }
    return true // Türkçe kelimeler için contains yeterli
  })
  if (matchedPartKeywords.length > 0) {
    confidence += 50
    reasons.push(`parça kelimesi: "${matchedPartKeywords[0]}"`)
  }

  // ── Kriter 2: Yedek parça ifadeleri (yüksek güven, +50) ──────────────
  const matchedPhrases = PART_PHRASES.filter(phrase =>
    combined.includes(phrase.toLowerCase())
  )
  if (matchedPhrases.length > 0) {
    confidence += 50
    reasons.push(`parça ifadesi: "${matchedPhrases[0]}"`)
  }

  // ── Kriter 3: Araç dışı ürün (yüksek güven, +60) ─────────────────────
  const matchedNonVehicle = NON_VEHICLE_KEYWORDS.filter(kw =>
    combined.includes(kw.toLowerCase())
  )
  if (matchedNonVehicle.length > 0) {
    confidence += 60
    reasons.push(`araç dışı ürün: "${matchedNonVehicle[0]}"`)
  }

  // ── Kriter 4: Geçersiz marka (orta güven, +40) ───────────────────────
  const matchedInvalidMake = INVALID_MAKES.find(m =>
    make === m || make.includes(m)
  )
  if (matchedInvalidMake) {
    confidence += 40
    reasons.push(`geçersiz marka: "${matchedInvalidMake}"`)
  }

  // ── Kriter 5: Çok düşük fiyat (orta güven, +30) ──────────────────────
  const isScooter = SCOOTER_MAKES.some(s => make.includes(s.toLowerCase())) ||
    SCOOTER_KEYWORDS.some(k => combined.includes(k))

  if (!isScooter && price > 0 && price < MIN_CAR_PRICE) {
    confidence += 30
    reasons.push(`çok düşük fiyat: ${price.toLocaleString('tr-TR')} ₺ (araç için)`)
  }
  if (isScooter && price > 0 && price < MIN_SCOOTER_PRICE) {
    confidence += 30
    reasons.push(`çok düşük fiyat: ${price.toLocaleString('tr-TR')} ₺ (scooter için)`)
  }

  // ── Kriter 6: "letgo" template + düşük fiyat (+20) ───────────────────
  // Letgo ilanlarında bazen "- letgo'dan Sıfırından Uygun Fiyata Al" var
  // Bu şablon + düşük fiyat = genelde parça
  if (combined.includes('letgo') && price > 0 && price < 50000) {
    confidence += 20
    reasons.push('letgo şablonu + düşük fiyat')
  }

  // ── Karar: güven 50+ ise parça ───────────────────────────────────────
  const isPart = confidence >= 50

  return {
    isPart,
    confidence: Math.min(confidence, 100),
    reasons,
  }
}

/**
 * Toplu filtreleme — scraper'lar için
 */
export function filterParts(listings: ListingForFilter[]): {
  kept: ListingForFilter[]
  filtered: ListingForFilter[]
  reasons: { listing: ListingForFilter; result: PartDetectionResult }[]
} {
  const kept: ListingForFilter[] = []
  const filtered: ListingForFilter[] = []
  const reasons: { listing: ListingForFilter; result: PartDetectionResult }[] = []

  for (const listing of listings) {
    const result = analyzeListing(listing)
    if (result.isPart) {
      filtered.push(listing)
      reasons.push({ listing, result })
    } else {
      kept.push(listing)
    }
  }

  return { kept, filtered, reasons }
}

// ═══════════════════════════════════════════════════════════════════════════
// DB TEMİZLİK BOTU
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DB'deki tüm aktif ilanları tara, parça olanları pasife al.
 * Cron her gece ve /api/admin/clean-parts endpoint'i çağırır.
 *
 * @returns { scanned, cleaned, kept, examples }
 */
export async function runPartsCleaningBot(): Promise<{
  scanned: number
  cleaned: number
  kept: number
  examples: { id: string; make: string; model: string; price: number; reasons: string[] }[]
  duration: number
}> {
  // Lazy import — db.ts'nin client bundle'a girmemesi için
  const { db } = await import('@/lib/db')

  const start = Date.now()
  console.log('[parts-cleaner] Tarama başlatılıyor...')

  // Tüm aktif ilanları çek — parça tespiti için gerekli alanlar
  const allListings = await db.listing.findMany({
    where: { isActive: true },
    select: {
      id: true,
      make: true,
      model: true,
      trim: true,
      description: true,
      price: true,
      year: true,
      bodyType: true,
      fuelType: true,
      sourceName: true,
    },
    take: 5000, // batch limit
  })

  console.log(`[parts-cleaner] ${allListings.length} aktif ilan taranıyor`)

  // Her ilanı analiz et
  const toDeactivate: { id: string; reasons: string[] }[] = []
  const examples: { id: string; make: string; model: string; price: number; reasons: string[] }[] = []

  for (const listing of allListings) {
    const result = analyzeListing({
      id: listing.id,
      make: listing.make,
      model: listing.model,
      trim: listing.trim,
      description: listing.description,
      price: listing.price,
      year: listing.year,
      bodyType: listing.bodyType,
      fuelType: listing.fuelType,
      sourceName: listing.sourceName,
    })

    if (result.isPart) {
      toDeactivate.push({ id: listing.id, reasons: result.reasons })

      // İlk 10 örneği sakla (log için)
      if (examples.length < 10) {
        examples.push({
          id: listing.id,
          make: listing.make,
          model: (listing.model || '').slice(0, 40),
          price: listing.price,
          reasons: result.reasons,
        })
      }
    }
  }

  console.log(`[parts-cleaner] ${toDeactivate.length} parça ilanı tespit edildi`)

  // Pasife al — batch halinde (her seferinde 100)
  const BATCH_SIZE = 100
  let cleaned = 0
  for (let i = 0; i < toDeactivate.length; i += BATCH_SIZE) {
    const batch = toDeactivate.slice(i, i + BATCH_SIZE)
    const ids = batch.map(b => b.id)
    try {
      const result = await db.listing.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false },
      })
      cleaned += result.count
    } catch (err) {
      console.error(`[parts-cleaner] Batch hata:`, err)
    }
  }

  const duration = Date.now() - start
  console.log(`[parts-cleaner] Tamamlandı: ${cleaned} ilan pasife alındı, ${duration}ms`)

  return {
    scanned: allListings.length,
    cleaned,
    kept: allListings.length - cleaned,
    examples,
    duration,
  }
}
