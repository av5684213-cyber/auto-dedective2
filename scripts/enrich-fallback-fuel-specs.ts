// Otodedektif - Fallback data'ya fabrika yakıt verisi ekleme scripti
//
// data/letgo-listings.json içindeki her listing'e factory fuel consumption
// değerlerini ekler. Değerler marka/model/yıl/yakıt tipi kombinasyonuna göre
// lookup tablosundan bulunur. Bulunamazsa null bırakılır (component tahmini kullanır).
//
// Usage: npx tsx scripts/enrich-fallback-fuel-specs.ts

import * as fs from 'node:fs';
import * as path from 'node:path';

// Factory spec lookup — vehicle-fuel-specs.ts içindeki ile aynı
interface FactorySpec {
  make: string;
  model: string;
  yearFrom?: number;
  yearEnd?: number;
  fuelType: string;
  city: number;
  highway: number;
  combined: number;
  unit: 'L' | 'kWh';
}

const FACTORY_SPECS: FactorySpec[] = [
  // Renault
  { make: 'Renault', model: 'clio', yearFrom: 2017, fuelType: 'Dizel', city: 4.0, highway: 3.4, combined: 3.7, unit: 'L' },
  { make: 'Renault', model: 'clio', yearFrom: 2017, fuelType: 'Benzin', city: 5.5, highway: 4.2, combined: 4.8, unit: 'L' },
  { make: 'Renault', model: 'megane', yearFrom: 2016, fuelType: 'Dizel', city: 4.4, highway: 3.6, combined: 3.9, unit: 'L' },
  { make: 'Renault', model: 'megane', yearFrom: 2016, fuelType: 'Benzin', city: 6.2, highway: 4.5, combined: 5.4, unit: 'L' },
  { make: 'Renault', model: 'symbol', yearFrom: 2017, fuelType: 'Dizel', city: 4.2, highway: 3.4, combined: 3.7, unit: 'L' },
  { make: 'Renault', model: 'symbol', yearFrom: 2017, fuelType: 'Benzin', city: 5.8, highway: 4.2, combined: 5.0, unit: 'L' },
  { make: 'Renault', model: 'captur', yearFrom: 2016, fuelType: 'Dizel', city: 4.6, highway: 3.7, combined: 4.0, unit: 'L' },
  { make: 'Renault', model: 'fluence', fuelType: 'Dizel', city: 4.9, highway: 3.9, combined: 4.2, unit: 'L' },
  { make: 'Renault', model: 'kadjar', yearFrom: 2016, fuelType: 'Dizel', city: 4.7, highway: 4.0, combined: 4.3, unit: 'L' },

  // Fiat
  { make: 'Fiat', model: 'egea', yearFrom: 2015, fuelType: 'Dizel', city: 4.3, highway: 3.5, combined: 3.8, unit: 'L' },
  { make: 'Fiat', model: 'egea', yearFrom: 2015, fuelType: 'Benzin', city: 6.6, highway: 4.6, combined: 5.4, unit: 'L' },
  { make: 'Fiat', model: 'egea', yearFrom: 2020, fuelType: 'Benzin', city: 6.0, highway: 4.2, combined: 4.9, unit: 'L' },
  { make: 'Fiat', model: 'linea', fuelType: 'Dizel', city: 4.7, highway: 3.7, combined: 4.0, unit: 'L' },
  { make: 'Fiat', model: 'linea', fuelType: 'Benzin', city: 7.0, highway: 4.8, combined: 5.6, unit: 'L' },
  { make: 'Fiat', model: '500', fuelType: 'Benzin', city: 5.7, highway: 4.1, combined: 4.7, unit: 'L' },
  { make: 'Fiat', model: 'doblo', fuelType: 'Dizel', city: 5.5, highway: 4.4, combined: 4.8, unit: 'L' },

  // Volkswagen
  { make: 'Volkswagen', model: 'golf', yearFrom: 2017, fuelType: 'Dizel', city: 4.4, highway: 3.5, combined: 3.8, unit: 'L' },
  { make: 'Volkswagen', model: 'golf', yearFrom: 2017, fuelType: 'Benzin', city: 6.0, highway: 4.4, combined: 5.0, unit: 'L' },
  { make: 'Volkswagen', model: 'passat', yearFrom: 2017, fuelType: 'Dizel', city: 5.0, highway: 3.9, combined: 4.3, unit: 'L' },
  { make: 'Volkswagen', model: 'polo', yearFrom: 2017, fuelType: 'Benzin', city: 5.6, highway: 4.1, combined: 4.7, unit: 'L' },
  { make: 'Volkswagen', model: 'tiguan', yearFrom: 2017, fuelType: 'Dizel', city: 5.8, highway: 4.7, combined: 5.2, unit: 'L' },
  { make: 'Volkswagen', model: 'caddy', fuelType: 'Dizel', city: 5.4, highway: 4.3, combined: 4.7, unit: 'L' },

  // Ford
  { make: 'Ford', model: 'focus', yearFrom: 2018, fuelType: 'Dizel', city: 4.5, highway: 3.6, combined: 4.0, unit: 'L' },
  { make: 'Ford', model: 'focus', yearFrom: 2018, fuelType: 'Benzin', city: 6.0, highway: 4.4, combined: 5.0, unit: 'L' },
  { make: 'Ford', model: 'fiesta', yearFrom: 2017, fuelType: 'Dizel', city: 4.0, highway: 3.2, combined: 3.5, unit: 'L' },
  { make: 'Ford', model: 'fiesta', yearFrom: 2017, fuelType: 'Benzin', city: 5.5, highway: 4.0, combined: 4.6, unit: 'L' },
  { make: 'Ford', model: 'kuga', yearFrom: 2019, fuelType: 'Dizel', city: 5.7, highway: 4.7, combined: 5.1, unit: 'L' },
  { make: 'Ford', model: 'tourneo courier', fuelType: 'Dizel', city: 5.2, highway: 4.1, combined: 4.6, unit: 'L' },

  // BMW
  { make: 'BMW', model: '3 serisi', yearFrom: 2018, fuelType: 'Benzin', city: 7.1, highway: 5.0, combined: 5.8, unit: 'L' },
  { make: 'BMW', model: '3 serisi', yearFrom: 2018, fuelType: 'Dizel', city: 5.0, highway: 4.0, combined: 4.5, unit: 'L' },
  { make: 'BMW', model: '5 serisi', yearFrom: 2017, fuelType: 'Benzin', city: 8.0, highway: 5.7, combined: 6.5, unit: 'L' },
  { make: 'BMW', model: '5 serisi', yearFrom: 2017, fuelType: 'Dizel', city: 5.5, highway: 4.3, combined: 4.8, unit: 'L' },
  { make: 'BMW', model: '1 serisi', yearFrom: 2019, fuelType: 'Benzin', city: 6.7, highway: 4.8, combined: 5.5, unit: 'L' },
  { make: 'BMW', model: 'x1', yearFrom: 2019, fuelType: 'Dizel', city: 5.4, highway: 4.4, combined: 4.8, unit: 'L' },

  // Mercedes
  { make: 'Mercedes-Benz', model: 'a 180', yearFrom: 2018, fuelType: 'Benzin', city: 7.1, highway: 5.0, combined: 5.8, unit: 'L' },
  { make: 'Mercedes-Benz', model: 'c 180', yearFrom: 2018, fuelType: 'Benzin', city: 7.5, highway: 5.3, combined: 6.0, unit: 'L' },
  { make: 'Mercedes-Benz', model: 'c 200', yearFrom: 2018, fuelType: 'Dizel', city: 5.0, highway: 4.0, combined: 4.4, unit: 'L' },
  { make: 'Mercedes-Benz', model: 'e 200', yearFrom: 2018, fuelType: 'Benzin', city: 8.5, highway: 5.8, combined: 6.8, unit: 'L' },

  // Toyota
  { make: 'Toyota', model: 'corolla', yearFrom: 2019, fuelType: 'Hybrid', city: 3.8, highway: 4.0, combined: 3.9, unit: 'L' },
  { make: 'Toyota', model: 'corolla', yearFrom: 2019, fuelType: 'Benzin', city: 6.5, highway: 4.8, combined: 5.5, unit: 'L' },
  { make: 'Toyota', model: 'yaris', yearFrom: 2020, fuelType: 'Hybrid', city: 3.5, highway: 3.8, combined: 3.6, unit: 'L' },
  { make: 'Toyota', model: 'c-hr', yearFrom: 2018, fuelType: 'Hybrid', city: 3.9, highway: 4.2, combined: 4.0, unit: 'L' },
  { make: 'Toyota', model: 'rav4', yearFrom: 2019, fuelType: 'Hybrid', city: 4.7, highway: 5.0, combined: 4.8, unit: 'L' },

  // Honda
  { make: 'Honda', model: 'civic', yearFrom: 2017, fuelType: 'Benzin', city: 6.7, highway: 4.9, combined: 5.6, unit: 'L' },
  { make: 'Honda', model: 'civic', yearFrom: 2017, fuelType: 'Dizel', city: 5.0, highway: 3.9, combined: 4.3, unit: 'L' },
  { make: 'Honda', model: 'cr-v', yearFrom: 2018, fuelType: 'Dizel', city: 5.8, highway: 4.7, combined: 5.2, unit: 'L' },

  // Hyundai
  { make: 'Hyundai', model: 'i20', yearFrom: 2020, fuelType: 'Benzin', city: 5.8, highway: 4.2, combined: 4.8, unit: 'L' },
  { make: 'Hyundai', model: 'i30', yearFrom: 2017, fuelType: 'Dizel', city: 4.7, highway: 3.7, combined: 4.0, unit: 'L' },
  { make: 'Hyundai', model: 'tucson', yearFrom: 2020, fuelType: 'Dizel', city: 5.7, highway: 4.6, combined: 5.0, unit: 'L' },

  // Peugeot
  { make: 'Peugeot', model: '208', yearFrom: 2019, fuelType: 'Benzin', city: 5.7, highway: 4.1, combined: 4.7, unit: 'L' },
  { make: 'Peugeot', model: '308', yearFrom: 2014, fuelType: 'Dizel', city: 4.5, highway: 3.6, combined: 3.9, unit: 'L' },
  { make: 'Peugeot', model: '3008', yearFrom: 2017, fuelType: 'Dizel', city: 5.1, highway: 4.0, combined: 4.4, unit: 'L' },

  // Opel
  { make: 'Opel', model: 'astra', yearFrom: 2016, fuelType: 'Benzin', city: 6.0, highway: 4.4, combined: 5.0, unit: 'L' },
  { make: 'Opel', model: 'astra', yearFrom: 2016, fuelType: 'Dizel', city: 4.5, highway: 3.6, combined: 3.9, unit: 'L' },
  { make: 'Opel', model: 'corsa', yearFrom: 2019, fuelType: 'Benzin', city: 5.6, highway: 4.1, combined: 4.6, unit: 'L' },
  { make: 'Opel', model: 'insignia', yearFrom: 2017, fuelType: 'Dizel', city: 5.0, highway: 4.0, combined: 4.4, unit: 'L' },

  // Skoda
  { make: 'Skoda', model: 'octavia', yearFrom: 2017, fuelType: 'Dizel', city: 4.5, highway: 3.6, combined: 3.9, unit: 'L' },
  { make: 'Skoda', model: 'octavia', yearFrom: 2017, fuelType: 'Benzin', city: 6.0, highway: 4.4, combined: 5.0, unit: 'L' },
  { make: 'Skoda', model: 'fabia', yearFrom: 2017, fuelType: 'Benzin', city: 5.6, highway: 4.1, combined: 4.6, unit: 'L' },
  { make: 'Skoda', model: 'superb', yearFrom: 2017, fuelType: 'Dizel', city: 5.1, highway: 4.0, combined: 4.4, unit: 'L' },
  { make: 'Skoda', model: 'scala', yearFrom: 2019, fuelType: 'Benzin', city: 6.3, highway: 4.6, combined: 5.2, unit: 'L' },

  // Dacia
  { make: 'Dacia', model: 'sandero', yearFrom: 2017, fuelType: 'Benzin', city: 5.6, highway: 4.1, combined: 4.6, unit: 'L' },
  { make: 'Dacia', model: 'duster', yearFrom: 2018, fuelType: 'Dizel', city: 5.1, highway: 4.2, combined: 4.5, unit: 'L' },

  // Audi
  { make: 'Audi', model: 'a3', yearFrom: 2017, fuelType: 'Dizel', city: 4.4, highway: 3.5, combined: 3.8, unit: 'L' },
  { make: 'Audi', model: 'a3', yearFrom: 2017, fuelType: 'Benzin', city: 6.0, highway: 4.4, combined: 5.0, unit: 'L' },
  { make: 'Audi', model: 'a4', yearFrom: 2017, fuelType: 'Dizel', city: 5.0, highway: 4.0, combined: 4.4, unit: 'L' },

  // Nissan
  { make: 'Nissan', model: 'qashqai', yearFrom: 2017, fuelType: 'Dizel', city: 5.0, highway: 4.0, combined: 4.4, unit: 'L' },
  { make: 'Nissan', model: 'juke', yearFrom: 2019, fuelType: 'Benzin', city: 6.4, highway: 4.7, combined: 5.3, unit: 'L' },

  // Kia
  { make: 'Kia', model: 'ceed', yearFrom: 2018, fuelType: 'Dizel', city: 4.7, highway: 3.7, combined: 4.1, unit: 'L' },
  { make: 'Kia', model: 'sportage', yearFrom: 2016, fuelType: 'Dizel', city: 5.3, highway: 4.3, combined: 4.7, unit: 'L' },
];

// Normalizasyon
function normalizeMake(make: string): string {
  return (make || '').toLowerCase().trim()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
}

function normalizeModel(model: string): string {
  return (model || '').toLowerCase().trim()
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
}

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

function findSpec(make: string, model: string, year: number, fuelType: string | null): FactorySpec | null {
  const normMake = normalizeMake(make);
  const normModel = normalizeModel(model);
  const normFuel = normalizeFuelType(fuelType);

  for (const spec of FACTORY_SPECS) {
    if (normalizeMake(spec.make) !== normMake) continue;
    const specNormModel = normalizeModel(spec.model);
    if (!normModel.includes(specNormModel) && !specNormModel.includes(normModel)) continue;
    // Hibrit için: spec.fuelType "Hybrid" olmalı, listing fuelType Hibrit olmalı
    if (spec.fuelType !== normFuel) {
      // Hybrid istisna: listing Hybrid ise spec Hybrid kullan
      if (!(normFuel === 'Hybrid' && spec.fuelType === 'Hybrid')) continue;
    }
    if (spec.yearFrom && year < spec.yearFrom) continue;
    if (spec.yearEnd && year > spec.yearEnd) continue;
    return spec;
  }
  return null;
}

function main() {
  const p = path.join(process.cwd(), 'data', 'letgo-listings.json');
  const listings = JSON.parse(fs.readFileSync(p, 'utf-8'));
  console.log(`Loaded ${listings.length} listings`);

  let matched = 0, unmatched = 0;

  for (const l of listings) {
    const spec = findSpec(l.make, l.model, l.year, l.fuelType);
    if (spec) {
      l.fuelConsumptionCity = spec.city;
      l.fuelConsumptionHighway = spec.highway;
      l.fuelConsumptionCombined = spec.combined;
      l.fuelConsumptionUnit = spec.unit;
      l.fuelConsumptionSource = 'factory';
      matched++;
    } else {
      l.fuelConsumptionCity = null;
      l.fuelConsumptionHighway = null;
      l.fuelConsumptionCombined = null;
      l.fuelConsumptionUnit = l.fuelType && l.fuelType.toLowerCase().includes('elektrik') ? 'kWh' : 'L';
      l.fuelConsumptionSource = null;
      unmatched++;
    }
  }

  console.log(`Matched: ${matched} listings (${(matched/listings.length*100).toFixed(1)}%)`);
  console.log(`Unmatched: ${unmatched} listings (component will use estimated)`);

  // Stats by make
  const byMake = new Map<string, { matched: number; total: number }>();
  for (const l of listings) {
    const m = l.make;
    if (!byMake.has(m)) byMake.set(m, { matched: 0, total: 0 });
    byMake.get(m)!.total++;
    if (l.fuelConsumptionCombined != null) byMake.get(m)!.matched++;
  }
  console.log('\nMatch rate by make (top 15):');
  const sorted = Array.from(byMake.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 15);
  for (const [make, { matched, total }] of sorted) {
    const pct = (matched / total * 100).toFixed(0);
    console.log(`  ${make}: ${matched}/${total} (${pct}%)`);
  }

  fs.writeFileSync(p, JSON.stringify(listings, null, 2), 'utf-8');
  const sizeKb = fs.statSync(p).size / 1024;
  console.log(`\n✅ Wrote enriched listings to ${p} (${sizeKb.toFixed(1)} KB)`);
}

main();
