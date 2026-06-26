// ── Accident status çıkarımı ──────────────────────────────────────────────
//
// İlan açıklamasından (description) ve ek metinlerden kazalı/hasarlı durumu otomatik çıkarır.
// Scraper'lar yeni ilan eklerken bu fonksiyonu çağırır ve listing.accidentStatus yazar.
//
// Çıktı değerleri (DB'de saklanır, alert filtresi olarak kullanılır):
//   - "kazasiz"           : Kazasız, boyasız, ilk sahibinden
//   - "az_hasarli"        : Az hasarlı (1-2 parça boyalı/değişen)
//   - "orta_hasarli"      : Orta hasarlı (3-5 parça boyalı/değişen)
//   - "agir_hasarli"      : Ağır hasarlı (pert kaydı, 6+ parça, trafik kazası)
//   - "belirsiz"          : Açıklamada bilgi yok
//
// Ağırlık mantığı: en ağır eşleşen keyword kazanır.
// Örn: "boyalı" + "pert kaydı" varsa → agir_hasarli

export type AccidentStatus = 'kazasiz' | 'az_hasarli' | 'orta_hasarli' | 'agir_hasarli' | 'belirsiz'

interface KeywordGroup {
  status: AccidentStatus
  weight: number // yüksek = daha ağır hasar
  keywords: string[]
}

const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    status: 'agir_hasarli',
    weight: 100,
    keywords: [
      'pert kaydı', 'pert kayit', 'pert',
      'ağır hasar', 'agir hasar', 'ağır hasarlı', 'agir hasarli',
      'trafik kazası', 'trafik kazasi', 'kaza geçirmiş', 'kaza gecirmis',
      'çıkma motor', 'cikma motor', 'motor değişmiş', 'motor degismis',
      'şase değişmiş', 'sase degismis', 'şase kaynağı', 'sase kaynagi',
      'araç tamiri', 'arac tamiri', 'kaporta tamiri',
      'versicherung', 'total loss',
    ],
  },
  {
    status: 'orta_hasarli',
    weight: 60,
    keywords: [
      'boyalı', 'boyali',
      'lokal boya', 'local boya',
      'değişen', 'degisen',
      'kapı değişmiş', 'kapi degismis',
      'motor kaputu değişmiş', 'kaput degismis',
      'bagaj değişmiş', 'bagaj degismis',
      'çamurluk değişmiş', 'camurluk degismis',
      'tampon değişmiş', 'tampon degismis',
      '3 parça boya', '4 parça boya', '5 parça boya',
      'boyalı var', 'local boyali',
    ],
  },
  {
    status: 'az_hasarli',
    weight: 30,
    keywords: [
      'tek parça boya', '1 parça boya',
      'iki parça boya', '2 parça boya',
      'lokal doktora', 'local doktora',
      'salt boya', 'kapı boyası', 'kapi boyasi',
      'tampon boyası', 'tampon boyasi',
      'boya düzeltme', 'boya duzeltme',
      'camurluk boya', 'çamurluk boya',
    ],
  },
  {
    status: 'kazasiz',
    weight: 0,
    keywords: [
      'kazasız', 'kazasiz',
      'boyasız', 'boyasiz',
      'orijinal boya', 'orijinal', 'original',
      'değişen yok', 'degisen yok',
      'boya yok', 'temiz araç', 'temiz arac',
      'doktora yok', 'hasarsız', 'hasarsiz',
      'ilk sahibinden', 'sahibinden satılık',
      'gerçek sahibi', 'gercek sahibi',
      'bayiden çıkma', 'garanti devam',
    ],
  },
]

/**
 * Verilen metinden accidentStatus çıkarır.
 *
 * @param text İlan açıklaması (description) ve diğer metinler
 * @returns { status: AccidentStatus, info: string } — info, eşleşen keyword'lerin özeti
 */
export function extractAccidentStatus(...texts: (string | null | undefined)[]): {
  status: AccidentStatus
  info: string
} {
  const combined = texts.filter(Boolean).join(' ').toLowerCase()

  if (!combined.trim()) {
    return { status: 'belirsiz', info: '' }
  }

  const matched: { status: AccidentStatus; weight: number; keyword: string }[] = []

  for (const group of KEYWORD_GROUPS) {
    for (const kw of group.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        matched.push({ status: group.status, weight: group.weight, keyword: kw })
      }
    }
  }

  if (matched.length === 0) {
    return { status: 'belirsiz', info: '' }
  }

  // En ağır (yüksek weight) eşleşme kazanır
  matched.sort((a, b) => b.weight - a.weight)
  const top = matched[0]

  // Info: en ağır 3 keyword'ü birleştir
  const topKws = matched.slice(0, 3).map(m => m.keyword)
  const info = topKws.join(', ')

  return { status: top.status, info }
}

/**
 * Listing için accidentStatus üret.
 * Scraper'lar create/update sırasında çağırır.
 */
export function deriveAccidentStatusForListing(listing: {
  description?: string | null
  make?: string
  model?: string
  trim?: string | null
  dealTag?: string | null
}): { status: AccidentStatus; info: string } {
  return extractAccidentStatus(listing.description, listing.trim, listing.dealTag)
}
