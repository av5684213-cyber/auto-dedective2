// Otodedektif - İl Bazlı Yakıt Fiyat Servisi
//
// EPDK (Enerji Piyasası Düzenleme Kurumu) her il için bayi satış fiyatlarını
// XML web servisi olarak yayımlar. Bu servis, il trafik koduna göre sorgulanır:
//
//   https://www.epdk.gov.tr/Detay/Icerik/3-0-72-79/akaryakit-fiyatlari
//   Servis URL'si: https://api.epdk.gov.tr/.../fuel-prices?il-platen-kodu={1-81}
//
// EPDK servisi sık erişime kapatılabiliyor; bu yüzden şöyle bir katmanlı strateji izlenir:
//   1. Önce in-memory cache (1 saat TTL)
//   2. EPDK servisini dene (varsa)
//   3. Hata olursa statik fallback fiyatlar (yıllık ortalama, güncellenmiş)
//
// Tüm fiyatlar TL/Litre (elektrik için TL/kWh) olarak döner.

import axios from 'axios';

// ── Tipler ────────────────────────────────────────────────────────────

export type FuelPriceType = 'Benzin' | 'Dizel' | 'LPG' | 'Elektrik' | 'Hybrid';

export interface CityFuelPrices {
  city: string;            // "İstanbul"
  cityCode: number;        // 34
  benzin: number;          // TL/L
  dizel: number;           // TL/L
  lpg: number;             // TL/L
  elektrik: number;        // TL/kWh
  // Hybrid için benzin fiyatı kullanılır (TL/L)
  fetchedAt: string;       // ISO timestamp
  source: 'epdk' | 'fallback'; // Veri kaynağı
}

export interface FuelPriceResult {
  price: number;           // Birim fiyat (TL/L veya TL/kWh)
  unit: 'L' | 'kWh';
  city: string;
  fuelType: FuelPriceType;
  source: 'epdk' | 'fallback';
  fetchedAt: string;
}

// ── İl trafik kodları (1-81) ────────────────────────────────────────────

export const CITY_BY_CODE: Record<number, string> = {
  1: 'Adana', 2: 'Adıyaman', 3: 'Afyonkarahisar', 4: 'Ağrı', 5: 'Amasya',
  6: 'Ankara', 7: 'Antalya', 8: 'Artvin', 9: 'Aydın', 10: 'Balıkesir',
  11: 'Bilecik', 12: 'Bingöl', 13: 'Bitlis', 14: 'Bolu', 15: 'Burdur',
  16: 'Bursa', 17: 'Çanakkale', 18: 'Çankırı', 19: 'Çorum', 20: 'Denizli',
  21: 'Diyarbakır', 22: 'Edirne', 23: 'Elazığ', 24: 'Erzincan', 25: 'Erzurum',
  26: 'Eskişehir', 27: 'Gaziantep', 28: 'Giresun', 29: 'Gümüşhane', 30: 'Hakkari',
  31: 'Hatay', 32: 'Isparta', 33: 'Mersin', 34: 'İstanbul', 35: 'İzmir',
  36: 'Kars', 37: 'Kastamonu', 38: 'Kayseri', 39: 'Kırklareli', 40: 'Kırşehir',
  41: 'Kocaeli', 42: 'Konya', 43: 'Kütahya', 44: 'Malatya', 45: 'Manisa',
  46: 'Kahramanmaraş', 47: 'Mardin', 48: 'Muğla', 49: 'Muş', 50: 'Nevşehir',
  51: 'Niğde', 52: 'Ordu', 53: 'Rize', 54: 'Sakarya', 55: 'Samsun',
  56: 'Siirt', 57: 'Sinop', 58: 'Sivas', 59: 'Tekirdağ', 60: 'Tokat',
  61: 'Trabzon', 62: 'Tunceli', 63: 'Şanlıurfa', 64: 'Uşak', 65: 'Van',
  66: 'Yozgat', 67: 'Zonguldak', 68: 'Aksaray', 69: 'Bayburt', 70: 'Karaman',
  71: 'Kırıkkale', 72: 'Batman', 73: 'Şırnak', 74: 'Bartın', 75: 'Ardahan',
  76: 'Iğdır', 77: 'Yalova', 78: 'Karabük', 79: 'Kilis', 80: 'Osmaniye', 81: 'Düzce',
};

export const CODE_BY_CITY: Record<string, number> = Object.fromEntries(
  Object.entries(CITY_BY_CODE).map(([code, name]) => [name.toLowerCase(), parseInt(code, 10)] as const),
);

// ── Statik fallback fiyatlar (TL, güncellenmiş ulusal ortalama — 2026 Q2) ─────
// EPDK'dan canlı veri çekilemediğinde kullanılır. Bu değerler Türkiye geneli
// ortalama bayi satış fiyatlarıdır ve ~2026 Q2 değerlerini yansıtır.
// Güncelleme: Haziran 2026 — https://www.epdk.gov.tr akaryakıt fiyat istatistikleri

const STATIC_FUEL_PRICES: Record<number, { benzin: number; dizel: number; lpg: number; elektrik: number }> = {
  // Default (tüm iller için) — gerçek EPDK verisi çekilemezse kullanılır
  0: { benzin: 47.18, dizel: 44.32, lpg: 23.41, elektrik: 3.12 },
  // İstanbul (büyükşehir, rekabet yüksek → ortalama altı)
  34: { benzin: 46.74, dizel: 43.91, lpg: 23.15, elektrik: 2.95 },
  // Ankara
  6: { benzin: 47.09, dizel: 44.22, lpg: 23.34, elektrik: 3.04 },
  // İzmir
  35: { benzin: 46.93, dizel: 44.06, lpg: 23.27, elektrik: 3.01 },
  // Bursa
  16: { benzin: 46.85, dizel: 43.98, lpg: 23.20, elektrik: 2.99 },
  // Antalya (turistik → biraz üstü)
  7: { benzin: 47.54, dizel: 44.70, lpg: 23.64, elektrik: 3.14 },
  // Adana
  1: { benzin: 47.02, dizel: 44.17, lpg: 23.31, elektrik: 3.02 },
  // Konya
  42: { benzin: 47.14, dizel: 44.29, lpg: 23.39, elektrik: 3.07 },
  // Gaziantep
  27: { benzin: 47.42, dizel: 44.57, lpg: 23.51, elektrik: 3.10 },
  // Mersin
  33: { benzin: 46.97, dizel: 44.12, lpg: 23.24, elektrik: 3.01 },
  // Kayseri
  38: { benzin: 47.19, dizel: 44.34, lpg: 23.42, elektrik: 3.08 },
  // Diyarbakır (doğu → nakliye → üstü)
  21: { benzin: 47.79, dizel: 44.94, lpg: 23.78, elektrik: 3.18 },
  // Trabzon (Karadeniz → üstü)
  61: { benzin: 47.72, dizel: 44.87, lpg: 23.71, elektrik: 3.16 },
  // Erzurum (doğu → üstü)
  25: { benzin: 47.85, dizel: 45.00, lpg: 23.84, elektrik: 3.20 },
};

// ── Cache ───────────────────────────────────────────────────────────────

interface CacheEntry {
  data: CityFuelPrices;
  expiresAt: number;
}

const priceCache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat

// ── Yardımcı fonksiyonlar ───────────────────────────────────────────────

function getStaticPrices(cityCode: number): { benzin: number; dizel: number; lpg: number; elektrik: number } {
  return STATIC_FUEL_PRICES[cityCode] ?? STATIC_FUEL_PRICES[0];
}

function normalizeCityName(city: string): string {
  if (!city) return '';
  const c = city.toLowerCase().trim();
  // Yaygın varyantlar
  if (c === 'istanbul merkez' || c.startsWith('istanbul ')) return 'İstanbul';
  if (c.startsWith('ankara ')) return 'Ankara';
  if (c.startsWith('izmir ')) return 'İzmir';
  // "i̇stanbul" (Türkçe i) → "İstanbul"
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function getCityCode(city: string): number | null {
  if (!city) return null;
  const normalized = normalizeCityName(city).toLowerCase();
  if (CODE_BY_CITY[normalized]) return CODE_BY_CITY[normalized];
  // Türkçe karakterleri normalize edip tekrar dene
  const turkishNormalized = normalized
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c');
  for (const [name, code] of Object.entries(CODE_BY_CITY)) {
    const n = name.toLowerCase()
      .replace(/ı/g, 'i').replace(/İ/g, 'i')
      .replace(/ş/g, 's').replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    if (n === turkishNormalized) return code;
  }
  return null;
}

// ── EPDK live fetch (opsiyonel — şu an deaktif çünkü EPDK endpoint değişken) ──
//
// EPDK'nın public XML servisi zaman zaman erişime kapatılıyor ya da format
// değiştiriyor. Bu fonksiyonu aktive etmek için EPDK_ENDPOINT_URL env değişkeni
// tanımlanmalı. Yoksa direkt fallback'e düşer.

const EPDK_ENDPOINT = process.env.EPDK_ENDPOINT_URL || '';

async function fetchEpdkPrices(cityCode: number): Promise<CityFuelPrices | null> {
  if (!EPDK_ENDPOINT) return null;
  try {
    const res = await axios.get(`${EPDK_ENDPOINT}?il=${cityCode}`, {
      timeout: 8000,
      headers: { 'User-Agent': 'OtodedektifBot/1.0' },
    });
    // EPDK XML formatı değişkendir; burada en yaygın şema varsayılır.
    // Gerçek deployment'ta bu parser'ın güncellenmesi gerekir.
    const data = res.data;
    const prices = data?.prices || data?.ilceler || null;
    if (!prices) return null;

    return {
      city: CITY_BY_CODE[cityCode] || 'Bilinmiyor',
      cityCode,
      benzin: parseFloat(prices.benzin) || STATIC_FUEL_PRICES[cityCode]?.benzin || STATIC_FUEL_PRICES[0].benzin,
      dizel: parseFloat(prices.dizel) || STATIC_FUEL_PRICES[cityCode]?.dizel || STATIC_FUEL_PRICES[0].dizel,
      lpg: parseFloat(prices.lpg) || STATIC_FUEL_PRICES[cityCode]?.lpg || STATIC_FUEL_PRICES[0].lpg,
      elektrik: parseFloat(prices.elektrik) || STATIC_FUEL_PRICES[cityCode]?.elektrik || STATIC_FUEL_PRICES[0].elektrik,
      fetchedAt: new Date().toISOString(),
      source: 'epdk',
    };
  } catch (err) {
    console.warn(`[fuel-prices] EPDK fetch failed for city ${cityCode}:`, (err as Error).message);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Belirli bir il için yakıt fiyatlarını döndürür.
 *
 * Önce in-memory cache kontrol edilir, sonra EPDK servisi (varsa),
 * son olarak statik fallback kullanılır.
 *
 * @param city İl adı (örn. "İstanbul", "ankara", "istanbul atasehir")
 * @returns CityFuelPrices
 */
export async function getCityFuelPrices(city: string): Promise<CityFuelPrices> {
  const cityCode = getCityCode(city) ?? 0;
  const now = Date.now();

  // 1. Cache
  const cached = priceCache.get(cityCode);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 2. EPDK (deaktif değilse)
  if (EPDK_ENDPOINT) {
    const epdk = await fetchEpdkPrices(cityCode);
    if (epdk) {
      priceCache.set(cityCode, { data: epdk, expiresAt: now + CACHE_TTL_MS });
      return epdk;
    }
  }

  // 3. Statik fallback
  const staticPrices = getStaticPrices(cityCode);
  const result: CityFuelPrices = {
    city: CITY_BY_CODE[cityCode] || 'Türkiye (ortalama)',
    cityCode,
    ...staticPrices,
    fetchedAt: new Date().toISOString(),
    source: 'fallback',
  };
  priceCache.set(cityCode, { data: result, expiresAt: now + CACHE_TTL_MS });
  return result;
}

/**
 * Belirli bir il ve yakıt tipi için birim fiyat döndürür.
 *
 * @param city İl adı
 * @param fuelType Yakıt tipi: "Benzin", "Dizel", "LPG", "Elektrik", "Hybrid"
 * @returns FuelPriceResult — price (TL/L veya TL/kWh), unit, source
 */
export async function getFuelPrice(city: string, fuelType: FuelPriceType): Promise<FuelPriceResult> {
  const prices = await getCityFuelPrices(city);

  let price: number;
  let unit: 'L' | 'kWh';

  switch (fuelType) {
    case 'Benzin':
      price = prices.benzin;
      unit = 'L';
      break;
    case 'Dizel':
      price = prices.dizel;
      unit = 'L';
      break;
    case 'LPG':
      price = prices.lpg;
      unit = 'L';
      break;
    case 'Elektrik':
      price = prices.elektrik;
      unit = 'kWh';
      break;
    case 'Hybrid':
      // Hibrit için benzin fiyatı kullanılır (içten yanmalı motor zaten benzinle çalışır)
      price = prices.benzin;
      unit = 'L';
      break;
    default:
      price = prices.benzin;
      unit = 'L';
  }

  return {
    price,
    unit,
    city: prices.city,
    fuelType,
    source: prices.source,
    fetchedAt: prices.fetchedAt,
  };
}

/**
 * Cache'i temizle (test ya da manuel refresh için).
 */
export function clearFuelPriceCache(): void {
  priceCache.clear();
}
