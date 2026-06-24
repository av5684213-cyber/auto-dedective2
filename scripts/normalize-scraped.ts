// Normalize make/city/fuel/transmission names in the fallback data file.
// Run after merge-scraped.ts to clean up inconsistencies.
//
// Usage: npx tsx scripts/normalize-scraped.ts

import * as fs from 'node:fs';
import * as path from 'node:path';

const MAKE_NORMALIZE: Record<string, string> = {
  'vw': 'Volkswagen',
  'volkswagen': 'Volkswagen',
  'VOLKSWAGEN': 'Volkswagen',
  'Volkswagen': 'Volkswagen',
  'mercedes': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'Mercedes-Benz': 'Mercedes-Benz',
  'MERCEDES-BENZ': 'Mercedes-Benz',
  'MERCEDES': 'Mercedes-Benz',
  'bmw': 'BMW',
  'BMW': 'BMW',
  'BMW ': 'BMW',
  'audi': 'Audi',
  'AUDI': 'Audi',
  'toyota': 'Toyota',
  'TOYOTA': 'Toyota',
  'honda': 'Honda',
  'HONDA': 'Honda',
  'hyundai': 'Hyundai',
  'HYUNDAI': 'Hyundai',
  'ford': 'Ford',
  'FORD': 'Ford',
  'renault': 'Renault',
  'RENAULT': 'Renault',
  'fiat': 'Fiat',
  'FIAT': 'Fiat',
  'peugeot': 'Peugeot',
  'PEUGEOT': 'Peugeot',
  'opel': 'Opel',
  'OPEL': 'Opel',
  'citroen': 'Citroen',
  'CITROEN': 'Citroen',
  'volvo': 'Volvo',
  'VOLVO': 'Volvo',
  'mazda': 'Mazda',
  'MAZDA': 'Mazda',
  'nissan': 'Nissan',
  'NISSAN': 'Nissan',
  'kia': 'Kia',
  'KIA': 'Kia',
  'skoda': 'Skoda',
  'SKODA': 'Skoda',
  'seat': 'Seat',
  'SEAT': 'Seat',
  'suzuki': 'Suzuki',
  'SUZUKI': 'Suzuki',
  'mitsubishi': 'Mitsubishi',
  'MITSUBISHI': 'Mitsubishi',
  'chevrolet': 'Chevrolet',
  'CHEVROLET': 'Chevrolet',
  'jeep': 'Jeep',
  'JEEP': 'Jeep',
  'lexus': 'Lexus',
  'LEXUS': 'Lexus',
  'infiniti': 'Infiniti',
  'INFINITI': 'Infiniti',
  'dacia': 'Dacia',
  'DACIA': 'Dacia',
  'tofas': 'Tofaş',
  'TOFAS': 'Tofaş',
  'chery': 'Chery',
  'CHERY': 'Chery',
  'alfa': 'Alfa Romeo',
  'alfa-romeo': 'Alfa Romeo',
  'ALFA': 'Alfa Romeo',
  'mini': 'Mini',
  'MINI': 'Mini',
  'land-rover': 'Land Rover',
  'range-rover': 'Land Rover',
  'LAND-ROVER': 'Land Rover',
  'RANGE-ROVER': 'Land Rover',
};

const CITY_NORMALIZE: Record<string, string> = {
  // Istanbul variants
  'istanbul': 'istanbul',
  'istanbul merkez': 'istanbul',
  'istanbul atasehir': 'istanbul',
  'istanbul ataşehir': 'istanbul',
  'istanbul kadıköy': 'istanbul',
  'istanbul kadikoy': 'istanbul',
  'istanbul üsküdar': 'istanbul',
  'istanbul uskudar': 'istanbul',
  'istanbul şişli': 'istanbul',
  'istanbul sisli': 'istanbul',
  'istanbul beşiktaş': 'istanbul',
  'istanbul besiktas': 'istanbul',
  'istanbul bakırköy': 'istanbul',
  'istanbul bakirkoy': 'istanbul',
  'istanbul maltepe': 'istanbul',
  'istanbul sarıyer': 'istanbul',
  'istanbul sariyer': 'istanbul',
  'istanbul beylikdüzü': 'istanbul',
  'istanbul beylikduzu': 'istanbul',
  'istanbul pendik': 'istanbul',
  'istanbul kartal': 'istanbul',
  'istanbul esenyurt': 'istanbul',
  'istanbul bahçelievler': 'istanbul',
  'istanbul bagcilar': 'istanbul',
  'istanbul başakşehir': 'istanbul',
  // Ankara
  'ankara': 'ankara',
  'ankara merkez': 'ankara',
  'ankara çankaya': 'ankara',
  'ankara yenimahalle': 'ankara',
  'ankara keçiören': 'ankara',
  // Izmir
  'izmir': 'izmir',
  'izmir merkez': 'izmir',
  'izmir bornova': 'izmir',
  'izmir karsiyaka': 'izmir',
  'izmir karşıyaka': 'izmir',
  'izmir buca': 'izmir',
  // Other cities — normalize Turkish chars
  'aydin': 'aydın',
  'aydın': 'aydın',
  'sanliurfa': 'şanlıurfa',
  'şanlıurfa': 'şanlıurfa',
  'diyarbakir': 'diyarbakır',
  'diyarbakır': 'diyarbakır',
  'eskisehir': 'eskişehir',
  'eskişehir': 'eskişehir',
  'kirsehir': 'kırşehir',
  'kırşehir': 'kırşehir',
  'kirklareli': 'kırklareli',
  'kırklareli': 'kırklareli',
  'kutahya': 'kütahya',
  'kütahya': 'kütahya',
  'mus': 'muş',
  'muş': 'muş',
};

function normalizeCity(raw: string | null): string | null {
  if (!raw) return null;
  const c = raw.toLowerCase().trim();
  if (CITY_NORMALIZE[c]) return CITY_NORMALIZE[c];
  // Try without district suffix (e.g. "ankara çankaya" → "ankara")
  for (const key of Object.keys(CITY_NORMALIZE)) {
    if (c.startsWith(key + ' ') || c.startsWith(key)) {
      return CITY_NORMALIZE[key];
    }
  }
  return c;
}

function normalizeMake(raw: string): string {
  if (!raw) return 'Bilinmiyor';
  const m = raw.trim();
  // Try exact lookup first
  if (MAKE_NORMALIZE[m]) return MAKE_NORMALIZE[m];
  // Try lowercase
  if (MAKE_NORMALIZE[m.toLowerCase()]) return MAKE_NORMALIZE[m.toLowerCase()];
  // Title-case fallback
  return m.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeModel(raw: string): string {
  if (!raw) return 'Bilinmiyor';
  // Just title-case the first letter of each word, but preserve all-caps acronyms (e.g. "GTI", "TSI")
  return raw
    .split(' ')
    .map((w) => {
      if (w.length <= 3 && w === w.toUpperCase()) return w; // keep short all-caps
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
}

function normalizeFuel(raw: string | null): string | null {
  if (!raw) return null;
  const f = raw.toLowerCase().trim();
  if (f === 'benzin') return 'Benzin';
  if (f === 'dizel' || f === 'diesel') return 'Dizel';
  if (f === 'lpg' || f === 'benzin + lpg' || f === 'benzin+lpg') return 'Benzin + LPG';
  if (f === 'elektrik') return 'Elektrik';
  if (f === 'hibrit' || f === 'hybrid') return 'Hibrit';
  return raw.trim();
}

function normalizeTransmission(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.toLowerCase().trim();
  if (t === 'manuel') return 'Manuel';
  if (t === 'otomatik') return 'Otomatik';
  if (t === 'yarı otomatik' || t === 'yari otomatik' || t === 'yarı-otomatik') return 'Yarı Otomatik';
  return raw.trim();
}

function main() {
  const p = path.join(process.cwd(), 'data', 'letgo-listings.json');
  const listings = JSON.parse(fs.readFileSync(p, 'utf-8'));
  console.log(`Loaded ${listings.length} listings`);

  let makeChanges = 0, cityChanges = 0, modelChanges = 0, fuelChanges = 0, transChanges = 0;

  for (const l of listings) {
    const newMake = normalizeMake(l.make);
    if (newMake !== l.make) { l.make = newMake; makeChanges++; }

    const newCity = normalizeCity(l.city ?? null);
    if (newCity !== l.city) { l.city = newCity; cityChanges++; }

    const newModel = normalizeModel(l.model);
    if (newModel !== l.model) { l.model = newModel; modelChanges++; }

    const newFuel = normalizeFuel(l.fuelType ?? null);
    if (newFuel !== l.fuelType) { l.fuelType = newFuel; fuelChanges++; }

    const newTrans = normalizeTransmission(l.transmission ?? null);
    if (newTrans !== l.transmission) { l.transmission = newTrans; transChanges++; }
  }

  console.log(`Make changes: ${makeChanges}`);
  console.log(`City changes: ${cityChanges}`);
  console.log(`Model changes: ${modelChanges}`);
  console.log(`Fuel changes: ${fuelChanges}`);
  console.log(`Transmission changes: ${transChanges}`);

  // Stats
  const byMake = new Map<string, number>();
  const byCity = new Map<string, number>();
  for (const l of listings) {
    byMake.set(l.make, (byMake.get(l.make) ?? 0) + 1);
    if (l.city) byCity.set(l.city, (byCity.get(l.city) ?? 0) + 1);
  }
  console.log('\nTop 10 makes (after normalization):');
  for (const [m, c] of Array.from(byMake.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${m}: ${c}`);
  }
  console.log('\nTop 10 cities (after normalization):');
  for (const [c, n] of Array.from(byCity.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${c}: ${n}`);
  }

  fs.writeFileSync(p, JSON.stringify(listings, null, 2), 'utf-8');
  const sizeKb = fs.statSync(p).size / 1024;
  console.log(`\n✅ Wrote ${listings.length} normalized listings to ${p} (${sizeKb.toFixed(1)} KB)`);
}

main();
