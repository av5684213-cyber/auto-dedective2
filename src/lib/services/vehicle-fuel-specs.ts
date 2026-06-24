// Otodedektif - Fabrika Yakıt Tüketim Verisi Lookup
//
// Bu modül marka/model/yıl/yakıt tipi kombinasyonuna göre fabrika yakıt
// tüketim değerlerini sağlar. Veri kaynağı üretici açıkladığı WLTP/NEDC değerleridir.
//
// Veri akışı:
//   1. Listing.kaydında fuelConsumptionCombined varsa → direkt onu kullan
//   2. Yoksa bu lookup tablosuna bak
//   3. O da yoksa yakıt tipine göre genel ortalama kullan (source='estimated')
//
// Tüm değerler L/100km (içten yanmalı/LPG/hibrit) veya kWh/100km (elektrik).

import { db } from '@/lib/db';

// ── Tipler ────────────────────────────────────────────────────────────

export interface VehicleFuelConsumption {
  city: number | null;        // L/100km veya kWh/100km
  highway: number | null;
  combined: number | null;    // Ana hesaplama için kullanılan değer
  unit: 'L' | 'kWh';
  source: 'factory' | 'estimated'; // Veri kaynağı
  /** Veri bulunamadıysa true (component uyarı gösterir) */
  isEstimated: boolean;
  /** Eşleşen fabrika kaydının açıklaması (debug için) */
  matchedFrom?: string;
}

// ── Statik fabrika veritabanı (en popüler modeller) ──────────────────────
//
// Bu liste üretici WLTP/NEDC değerlerine dayanır. Türkiye pazarındaki en çok
// satan modeller için seçilmiştir. Yeni model eklenebilir.

interface FactorySpec {
  make: string;
  model: string;        // model adı küçük harfle yazılır, prefix match yapılır
  yearFrom?: number;
  yearEnd?: number;
  fuelType: string;     // "Benzin" | "Dizel" | "Hybrid" | "Elektrik" | "LPG"
  engineCc?: number;
  city: number;
  highway: number;
  combined: number;
  unit: 'L' | 'kWh';
  source: 'WLTP' | 'NEDC' | 'manufacturer';
}

const FACTORY_SPECS: FactorySpec[] = [
  // ── Renault ────────────────────────────────────────────────────────
  { make: 'Renault', model: 'clio', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1461, city: 4.0, highway: 3.4, combined: 3.7, unit: 'L', source: 'NEDC' },
  { make: 'Renault', model: 'clio', yearFrom: 2017, fuelType: 'Benzin', engineCc: 898, city: 5.5, highway: 4.2, combined: 4.8, unit: 'L', source: 'NEDC' },
  { make: 'Renault', model: 'megane', yearFrom: 2016, fuelType: 'Dizel', engineCc: 1461, city: 4.4, highway: 3.6, combined: 3.9, unit: 'L', source: 'NEDC' },
  { make: 'Renault', model: 'megane', yearFrom: 2016, fuelType: 'Benzin', engineCc: 1197, city: 6.2, highway: 4.5, combined: 5.4, unit: 'L', source: 'NEDC' },
  { make: 'Renault', model: 'symbol', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1461, city: 4.2, highway: 3.4, combined: 3.7, unit: 'L', source: 'NEDC' },
  { make: 'Renault', model: 'symbol', yearFrom: 2017, fuelType: 'Benzin', engineCc: 999, city: 5.8, highway: 4.2, combined: 5.0, unit: 'L', source: 'NEDC' },
  { make: 'Renault', model: 'captur', yearFrom: 2016, fuelType: 'Dizel', engineCc: 1461, city: 4.6, highway: 3.7, combined: 4.0, unit: 'L', source: 'NEDC' },
  { make: 'Renault', model: 'fluence', fuelType: 'Dizel', engineCc: 1461, city: 4.9, highway: 3.9, combined: 4.2, unit: 'L', source: 'NEDC' },
  { make: 'Renault', model: 'kadjar', yearFrom: 2016, fuelType: 'Dizel', engineCc: 1461, city: 4.7, highway: 4.0, combined: 4.3, unit: 'L', source: 'NEDC' },

  // ── Fiat ──────────────────────────────────────────────────────────
  { make: 'Fiat', model: 'egea', yearFrom: 2015, fuelType: 'Dizel', engineCc: 1248, city: 4.3, highway: 3.5, combined: 3.8, unit: 'L', source: 'NEDC' },
  { make: 'Fiat', model: 'egea', yearFrom: 2015, fuelType: 'Benzin', engineCc: 1368, city: 6.6, highway: 4.6, combined: 5.4, unit: 'L', source: 'NEDC' },
  { make: 'Fiat', model: 'egea', yearFrom: 2020, fuelType: 'Benzin', engineCc: 999, city: 6.0, highway: 4.2, combined: 4.9, unit: 'L', source: 'NEDC' },
  { make: 'Fiat', model: 'linea', fuelType: 'Dizel', engineCc: 1248, city: 4.7, highway: 3.7, combined: 4.0, unit: 'L', source: 'NEDC' },
  { make: 'Fiat', model: 'linea', fuelType: 'Benzin', engineCc: 1368, city: 7.0, highway: 4.8, combined: 5.6, unit: 'L', source: 'NEDC' },
  { make: 'Fiat', model: '500', fuelType: 'Benzin', engineCc: 875, city: 5.7, highway: 4.1, combined: 4.7, unit: 'L', source: 'NEDC' },
  { make: 'Fiat', model: 'doblo', fuelType: 'Dizel', engineCc: 1248, city: 5.5, highway: 4.4, combined: 4.8, unit: 'L', source: 'NEDC' },

  // ── Volkswagen ──────────────────────────────────────────────────────
  { make: 'Volkswagen', model: 'golf', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1598, city: 4.4, highway: 3.5, combined: 3.8, unit: 'L', source: 'NEDC' },
  { make: 'Volkswagen', model: 'golf', yearFrom: 2017, fuelType: 'Benzin', engineCc: 1395, city: 6.0, highway: 4.4, combined: 5.0, unit: 'L', source: 'NEDC' },
  { make: 'Volkswagen', model: 'passat', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1968, city: 5.0, highway: 3.9, combined: 4.3, unit: 'L', source: 'NEDC' },
  { make: 'Volkswagen', model: 'polo', yearFrom: 2017, fuelType: 'Benzin', engineCc: 999, city: 5.6, highway: 4.1, combined: 4.7, unit: 'L', source: 'NEDC' },
  { make: 'Volkswagen', model: 'tiguan', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1968, city: 5.8, highway: 4.7, combined: 5.2, unit: 'L', source: 'NEDC' },
  { make: 'Volkswagen', model: 'caddy', fuelType: 'Dizel', engineCc: 1598, city: 5.4, highway: 4.3, combined: 4.7, unit: 'L', source: 'NEDC' },

  // ── Ford ──────────────────────────────────────────────────────────
  { make: 'Ford', model: 'focus', yearFrom: 2018, fuelType: 'Dizel', engineCc: 1499, city: 4.5, highway: 3.6, combined: 4.0, unit: 'L', source: 'NEDC' },
  { make: 'Ford', model: 'focus', yearFrom: 2018, fuelType: 'Benzin', engineCc: 999, city: 6.0, highway: 4.4, combined: 5.0, unit: 'L', source: 'NEDC' },
  { make: 'Ford', model: 'fiesta', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1499, city: 4.0, highway: 3.2, combined: 3.5, unit: 'L', source: 'NEDC' },
  { make: 'Ford', model: 'fiesta', yearFrom: 2017, fuelType: 'Benzin', engineCc: 999, city: 5.5, highway: 4.0, combined: 4.6, unit: 'L', source: 'NEDC' },
  { make: 'Ford', model: 'kuga', yearFrom: 2019, fuelType: 'Dizel', engineCc: 1997, city: 5.7, highway: 4.7, combined: 5.1, unit: 'L', source: 'NEDC' },
  { make: 'Ford', model: 'tourneo courier', fuelType: 'Dizel', engineCc: 1499, city: 5.2, highway: 4.1, combined: 4.6, unit: 'L', source: 'NEDC' },

  // ── BMW ───────────────────────────────────────────────────────────
  { make: 'BMW', model: '3 serisi', yearFrom: 2018, fuelType: 'Benzin', engineCc: 1499, city: 7.1, highway: 5.0, combined: 5.8, unit: 'L', source: 'WLTP' },
  { make: 'BMW', model: '3 serisi', yearFrom: 2018, fuelType: 'Dizel', engineCc: 1499, city: 5.0, highway: 4.0, combined: 4.5, unit: 'L', source: 'WLTP' },
  { make: 'BMW', model: '5 serisi', yearFrom: 2017, fuelType: 'Benzin', engineCc: 1998, city: 8.0, highway: 5.7, combined: 6.5, unit: 'L', source: 'WLTP' },
  { make: 'BMW', model: '5 serisi', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1995, city: 5.5, highway: 4.3, combined: 4.8, unit: 'L', source: 'WLTP' },
  { make: 'BMW', model: '1 serisi', yearFrom: 2019, fuelType: 'Benzin', engineCc: 1499, city: 6.7, highway: 4.8, combined: 5.5, unit: 'L', source: 'WLTP' },
  { make: 'BMW', model: 'x1', yearFrom: 2019, fuelType: 'Dizel', engineCc: 1495, city: 5.4, highway: 4.4, combined: 4.8, unit: 'L', source: 'WLTP' },

  // ── Mercedes-Benz ────────────────────────────────────────────────────
  { make: 'Mercedes-Benz', model: 'a 180', yearFrom: 2018, fuelType: 'Benzin', engineCc: 1332, city: 7.1, highway: 5.0, combined: 5.8, unit: 'L', source: 'WLTP' },
  { make: 'Mercedes-Benz', model: 'c 180', yearFrom: 2018, fuelType: 'Benzin', engineCc: 1595, city: 7.5, highway: 5.3, combined: 6.0, unit: 'L', source: 'WLTP' },
  { make: 'Mercedes-Benz', model: 'c 200', yearFrom: 2018, fuelType: 'Dizel', engineCc: 1595, city: 5.0, highway: 4.0, combined: 4.4, unit: 'L', source: 'WLTP' },
  { make: 'Mercedes-Benz', model: 'e 200', yearFrom: 2018, fuelType: 'Benzin', engineCc: 1991, city: 8.5, highway: 5.8, combined: 6.8, unit: 'L', source: 'WLTP' },

  // ── Toyota ──────────────────────────────────────────────────────────
  { make: 'Toyota', model: 'corolla', yearFrom: 2019, fuelType: 'Hybrid', engineCc: 1798, city: 3.8, highway: 4.0, combined: 3.9, unit: 'L', source: 'WLTP' },
  { make: 'Toyota', model: 'corolla', yearFrom: 2019, fuelType: 'Benzin', engineCc: 1598, city: 6.5, highway: 4.8, combined: 5.5, unit: 'L', source: 'WLTP' },
  { make: 'Toyota', model: 'yaris', yearFrom: 2020, fuelType: 'Hybrid', engineCc: 1490, city: 3.5, highway: 3.8, combined: 3.6, unit: 'L', source: 'WLTP' },
  { make: 'Toyota', model: 'c-hr', yearFrom: 2018, fuelType: 'Hybrid', engineCc: 1798, city: 3.9, highway: 4.2, combined: 4.0, unit: 'L', source: 'WLTP' },
  { make: 'Toyota', model: 'rav4', yearFrom: 2019, fuelType: 'Hybrid', engineCc: 2487, city: 4.7, highway: 5.0, combined: 4.8, unit: 'L', source: 'WLTP' },

  // ── Honda ──────────────────────────────────────────────────────────
  { make: 'Honda', model: 'civic', yearFrom: 2017, fuelType: 'Benzin', engineCc: 1498, city: 6.7, highway: 4.9, combined: 5.6, unit: 'L', source: 'NEDC' },
  { make: 'Honda', model: 'civic', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1597, city: 5.0, highway: 3.9, combined: 4.3, unit: 'L', source: 'NEDC' },
  { make: 'Honda', model: 'cr-v', yearFrom: 2018, fuelType: 'Dizel', engineCc: 1597, city: 5.8, highway: 4.7, combined: 5.2, unit: 'L', source: 'NEDC' },

  // ── Hyundai ──────────────────────────────────────────────────────────
  { make: 'Hyundai', model: 'i20', yearFrom: 2020, fuelType: 'Benzin', engineCc: 998, city: 5.8, highway: 4.2, combined: 4.8, unit: 'L', source: 'WLTP' },
  { make: 'Hyundai', model: 'i30', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1598, city: 4.7, highway: 3.7, combined: 4.0, unit: 'L', source: 'NEDC' },
  { make: 'Hyundai', model: 'tucson', yearFrom: 2020, fuelType: 'Dizel', engineCc: 1598, city: 5.7, highway: 4.6, combined: 5.0, unit: 'L', source: 'WLTP' },

  // ── Peugeot ──────────────────────────────────────────────────────────
  { make: 'Peugeot', model: '208', yearFrom: 2019, fuelType: 'Benzin', engineCc: 1199, city: 5.7, highway: 4.1, combined: 4.7, unit: 'L', source: 'WLTP' },
  { make: 'Peugeot', model: '308', yearFrom: 2014, fuelType: 'Dizel', engineCc: 1560, city: 4.5, highway: 3.6, combined: 3.9, unit: 'L', source: 'NEDC' },
  { make: 'Peugeot', model: '3008', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1499, city: 5.1, highway: 4.0, combined: 4.4, unit: 'L', source: 'WLTP' },

  // ── Opel ──────────────────────────────────────────────────────────
  { make: 'Opel', model: 'astra', yearFrom: 2016, fuelType: 'Benzin', engineCc: 1399, city: 6.0, highway: 4.4, combined: 5.0, unit: 'L', source: 'NEDC' },
  { make: 'Opel', model: 'astra', yearFrom: 2016, fuelType: 'Dizel', engineCc: 1499, city: 4.5, highway: 3.6, combined: 3.9, unit: 'L', source: 'NEDC' },
  { make: 'Opel', model: 'corsa', yearFrom: 2019, fuelType: 'Benzin', engineCc: 1199, city: 5.6, highway: 4.1, combined: 4.6, unit: 'L', source: 'WLTP' },
  { make: 'Opel', model: 'insignia', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1598, city: 5.0, highway: 4.0, combined: 4.4, unit: 'L', source: 'WLTP' },

  // ── Skoda ──────────────────────────────────────────────────────────
  { make: 'Skoda', model: 'octavia', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1598, city: 4.5, highway: 3.6, combined: 3.9, unit: 'L', source: 'NEDC' },
  { make: 'Skoda', model: 'octavia', yearFrom: 2017, fuelType: 'Benzin', engineCc: 1395, city: 6.0, highway: 4.4, combined: 5.0, unit: 'L', source: 'NEDC' },
  { make: 'Skoda', model: 'fabia', yearFrom: 2017, fuelType: 'Benzin', engineCc: 999, city: 5.6, highway: 4.1, combined: 4.6, unit: 'L', source: 'NEDC' },
  { make: 'Skoda', model: 'superb', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1968, city: 5.1, highway: 4.0, combined: 4.4, unit: 'L', source: 'NEDC' },
  { make: 'Skoda', model: 'scala', yearFrom: 2019, fuelType: 'Benzin', engineCc: 1490, city: 6.3, highway: 4.6, combined: 5.2, unit: 'L', source: 'WLTP' },

  // ── Dacia ──────────────────────────────────────────────────────────
  { make: 'Dacia', model: 'sandero', yearFrom: 2017, fuelType: 'Benzin', engineCc: 898, city: 5.6, highway: 4.1, combined: 4.6, unit: 'L', source: 'NEDC' },
  { make: 'Dacia', model: 'duster', yearFrom: 2018, fuelType: 'Dizel', engineCc: 1461, city: 5.1, highway: 4.2, combined: 4.5, unit: 'L', source: 'NEDC' },

  // ── Audi ──────────────────────────────────────────────────────────
  { make: 'Audi', model: 'a3', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1598, city: 4.4, highway: 3.5, combined: 3.8, unit: 'L', source: 'NEDC' },
  { make: 'Audi', model: 'a3', yearFrom: 2017, fuelType: 'Benzin', engineCc: 1395, city: 6.0, highway: 4.4, combined: 5.0, unit: 'L', source: 'NEDC' },
  { make: 'Audi', model: 'a4', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1968, city: 5.0, highway: 4.0, combined: 4.4, unit: 'L', source: 'NEDC' },

  // ── Nissan ──────────────────────────────────────────────────────────
  { make: 'Nissan', model: 'qashqai', yearFrom: 2017, fuelType: 'Dizel', engineCc: 1598, city: 5.0, highway: 4.0, combined: 4.4, unit: 'L', source: 'NEDC' },
  { make: 'Nissan', model: 'juke', yearFrom: 2019, fuelType: 'Benzin', engineCc: 1498, city: 6.4, highway: 4.7, combined: 5.3, unit: 'L', source: 'WLTP' },

  // ── Kia ──────────────────────────────────────────────────────────
  { make: 'Kia', model: 'ceed', yearFrom: 2018, fuelType: 'Dizel', engineCc: 1598, city: 4.7, highway: 3.7, combined: 4.1, unit: 'L', source: 'NEDC' },
  { make: 'Kia', model: 'sportage', yearFrom: 2016, fuelType: 'Dizel', engineCc: 1598, city: 5.3, highway: 4.3, combined: 4.7, unit: 'L', source: 'NEDC' },
];

// ── Yakıt tipine göre genel tahmini tüketim (fabrika verisi yoksa) ──────

const ESTIMATED_CONSUMPTION: Record<string, { city: number; highway: number; combined: number; unit: 'L' | 'kWh' }> = {
  Benzin: { city: 8.0, highway: 5.5, combined: 6.8, unit: 'L' },
  Dizel: { city: 6.5, highway: 4.5, combined: 5.4, unit: 'L' },
  LPG: { city: 9.5, highway: 6.5, combined: 8.0, unit: 'L' },
  Hybrid: { city: 4.5, highway: 4.5, combined: 4.5, unit: 'L' },
  'Benzin + LPG': { city: 8.5, highway: 6.0, combined: 7.2, unit: 'L' }, // karışık
  Elektrik: { city: 16.0, highway: 13.0, combined: 14.5, unit: 'kWh' },
};

// ── Yardımcılar ────────────────────────────────────────────────────────

function normalizeFuelType(fuelType: string | null): string {
  if (!fuelType) return 'Benzin';
  const f = fuelType.toLowerCase().trim();
  if (f.includes('dizel') || f.includes('diesel')) return 'Dizel';
  if (f.includes('elektrik') || f.includes('electric')) return 'Elektrik';
  if (f.includes('hybrid') || f.includes('hibrit')) return 'Hybrid';
  if (f === 'lpg' || f === 'otogaz') return 'LPG';
  if (f.includes('lpg') && f.includes('benzin')) return 'Benzin + LPG';
  if (f.includes('benzin') || f.includes('gasoline') || f.includes('petrol')) return 'Benzin';
  return 'Benzin';
}

function normalizeModel(model: string): string {
  return model.toLowerCase().trim()
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
}

function normalizeMake(make: string): string {
  return make.toLowerCase().trim()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
}

// ── Lookup fonksiyonu ───────────────────────────────────────────────────

/**
 * Verilen araç için fabrika yakıt tüketim verisini bulur.
 *
 * Arama sırası:
 *   1. Listing kaydındaki fuelConsumptionCombined (eğer doluysa)
 *   2. DB'deki VehicleFuelSpec tablosu (eğer DB ulaşılabilir durumdaysa)
 *   3. Statik FACTORY_SPECS lookup tablosu
 *   4. Yakıt tipine göre tahmini ortalama (isEstimated=true)
 *
 * @param listing Listing objesi (make, model, year, fuelType, fuelConsumptionCombined içermeli)
 */
export async function getVehicleFuelConsumption(listing: {
  make: string;
  model: string;
  year: number;
  fuelType?: string | null;
  fuelConsumptionCity?: number | null;
  fuelConsumptionHighway?: number | null;
  fuelConsumptionCombined?: number | null;
  fuelConsumptionUnit?: string | null;
  fuelConsumptionSource?: string | null;
}): Promise<VehicleFuelConsumption> {
  const fuelType = normalizeFuelType(listing.fuelType);
  const unit: 'L' | 'kWh' = fuelType === 'Elektrik' ? 'kWh' : 'L';

  // 1. Listing kaydında fabrika verisi varsa direkt kullan
  if (listing.fuelConsumptionCombined != null && listing.fuelConsumptionCombined > 0) {
    return {
      city: listing.fuelConsumptionCity ?? null,
      highway: listing.fuelConsumptionHighway ?? null,
      combined: listing.fuelConsumptionCombined,
      unit: (listing.fuelConsumptionUnit as 'L' | 'kWh') ?? unit,
      source: (listing.fuelConsumptionSource as 'factory' | 'estimated') ?? 'factory',
      isEstimated: false,
      matchedFrom: 'listing.fuelConsumptionCombined',
    };
  }

  // 2. DB VehicleFuelSpec tablosu
  try {
    const spec = await db.vehicleFuelSpec.findFirst({
      where: {
        make: { equals: listing.make },
        model: { equals: listing.model },
        fuelType: { equals: fuelType },
        AND: [
          { OR: [{ yearFrom: null }, { yearFrom: { lte: listing.year } }] },
          { OR: [{ yearEnd: null }, { yearEnd: { gte: listing.year } }] },
        ],
      },
      orderBy: { yearFrom: 'desc' },
    });
    if (spec && spec.consumptionCombined) {
      return {
        city: spec.consumptionCity,
        highway: spec.consumptionHighway,
        combined: spec.consumptionCombined,
        unit: spec.unit as 'L' | 'kWh',
        source: 'factory',
        isEstimated: false,
        matchedFrom: `db:${spec.source}`,
      };
    }
  } catch (err) {
    // DB erişilemiyor olabilir (fallback mode) — sesizce devam et
  }

  // 3. Statik FACTORY_SPECS lookup
  const normMake = normalizeMake(listing.make);
  const normModel = normalizeModel(listing.model);

  for (const spec of FACTORY_SPECS) {
    if (normalizeMake(spec.make) !== normMake) continue;
    if (!normModel.includes(normalizeModel(spec.model)) && !normalizeModel(spec.model).includes(normModel)) continue;
    if (spec.fuelType !== fuelType) continue;
    if (spec.yearFrom && listing.year < spec.yearFrom) continue;
    if (spec.yearEnd && listing.year > spec.yearEnd) continue;

    return {
      city: spec.city,
      highway: spec.highway,
      combined: spec.combined,
      unit: spec.unit,
      source: 'factory',
      isEstimated: false,
      matchedFrom: `factory-specs:${spec.source}`,
    };
  }

  // 4. Tahmini ortalama
  const est = ESTIMATED_CONSUMPTION[fuelType] ?? ESTIMATED_CONSUMPTION.Benzin;
  return {
    city: est.city,
    highway: est.highway,
    combined: est.combined,
    unit: est.unit,
    source: 'estimated',
    isEstimated: true,
    matchedFrom: `estimated:${fuelType}`,
  };
}

/**
 * Senkron versiyon — Listing kaydında fabrika verisi varsa onu döndürür,
 * yoksa tahmini değeri döndürür (DB/lookup'a gitmez).
 *
 * Component'in ilk render'ında kullanılır, sonra async versiyonla güncellenir.
 */
export function getVehicleFuelConsumptionSync(listing: {
  make: string;
  model: string;
  year: number;
  fuelType?: string | null;
  fuelConsumptionCity?: number | null;
  fuelConsumptionHighway?: number | null;
  fuelConsumptionCombined?: number | null;
  fuelConsumptionUnit?: string | null;
  fuelConsumptionSource?: string | null;
}): VehicleFuelConsumption {
  const fuelType = normalizeFuelType(listing.fuelType);
  const unit: 'L' | 'kWh' = fuelType === 'Elektrik' ? 'kWh' : 'L';

  // Listing kaydında fabrika verisi varsa
  if (listing.fuelConsumptionCombined != null && listing.fuelConsumptionCombined > 0) {
    return {
      city: listing.fuelConsumptionCity ?? null,
      highway: listing.fuelConsumptionHighway ?? null,
      combined: listing.fuelConsumptionCombined,
      unit: (listing.fuelConsumptionUnit as 'L' | 'kWh') ?? unit,
      source: (listing.fuelConsumptionSource as 'factory' | 'estimated') ?? 'factory',
      isEstimated: false,
      matchedFrom: 'listing.fuelConsumptionCombined',
    };
  }

  // Statik lookup (senkron)
  const normMake = normalizeMake(listing.make);
  const normModel = normalizeModel(listing.model);
  for (const spec of FACTORY_SPECS) {
    if (normalizeMake(spec.make) !== normMake) continue;
    if (!normModel.includes(normalizeModel(spec.model)) && !normalizeModel(spec.model).includes(normModel)) continue;
    if (spec.fuelType !== fuelType) continue;
    if (spec.yearFrom && listing.year < spec.yearFrom) continue;
    if (spec.yearEnd && listing.year > spec.yearEnd) continue;

    return {
      city: spec.city,
      highway: spec.highway,
      combined: spec.combined,
      unit: spec.unit,
      source: 'factory',
      isEstimated: false,
      matchedFrom: `factory-specs:${spec.source}`,
    };
  }

  // Tahmini ortalama
  const est = ESTIMATED_CONSUMPTION[fuelType] ?? ESTIMATED_CONSUMPTION.Benzin;
  return {
    city: est.city,
    highway: est.highway,
    combined: est.combined,
    unit: est.unit,
    source: 'estimated',
    isEstimated: true,
    matchedFrom: `estimated:${fuelType}`,
  };
}
