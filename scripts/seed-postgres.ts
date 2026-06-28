// Seed PostgreSQL from JSON files in repo/data/
import { db } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

interface RawListing {
  id?: string;
  sourceName: string;
  sourceUrl: string;
  vin?: string | null;
  make: string;
  model: string;
  trim?: string | null;
  year: number;
  price: number;
  currency?: string;
  mileageKm?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  bodyType?: string | null;
  color?: string | null;
  city?: string | null;
  district?: string | null;
  sellerType?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | string | null;
  description?: string | null;
  firstSeenAt?: string;
  lastSeenAt?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  estimatedValue?: number | null;
  confidence?: string | null;
  dealScore?: number | null;
  dealTag?: string | null;
  comparableCount?: number;
  annualDepreciationPercent?: number | null;
  annualDepreciationAmount?: number | null;
  ownershipCostAnnual?: number | null;
  fuelCostAnnual?: number | null;
  insuranceCostAnnual?: number | null;
  maintenanceCostAnnual?: number | null;
  taxCostAnnual?: number | null;
  fuelConsumptionCity?: number | null;
  fuelConsumptionHighway?: number | null;
  fuelConsumptionCombined?: number | null;
  fuelConsumptionUnit?: string | null;
  fuelConsumptionSource?: string | null;
  accidentStatus?: string | null;
  damageInfo?: string | null;
}

const DATA_DIR = '/home/z/my-project/repo/data';

function loadListings(): RawListing[] {
  const files = [
    'letgo-listings.json',
    'scraped-otosor.json',
    'scraped-otosor-805.json',
    'scraped-fordikinciel.json',
    'scraped-intercity2.json',
    'scraped-letgo.json',
  ];
  const seen = new Set<string>();
  const out: RawListing[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(DATA_DIR, f), 'utf8');
      const arr = JSON.parse(raw) as RawListing[];
      for (const item of arr) {
        if (!item?.sourceUrl || seen.has(item.sourceUrl)) continue;
        seen.add(item.sourceUrl);
        out.push(item);
      }
      console.log(`[seed] Loaded ${arr.length} from ${f}`);
    } catch (err) {
      console.warn(`[seed] Could not load ${f}`);
    }
  }
  return out;
}

async function main() {
  const listings = loadListings();
  console.log(`[seed] ${listings.length} unique listings to insert`);

  await db.priceHistory.deleteMany();
  await db.listing.deleteMany();

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < listings.length; i += BATCH) {
    const batch = listings.slice(i, i + BATCH);
    const payload = batch.map((l) => ({
      id: l.id ?? undefined,
      sourceName: l.sourceName,
      sourceUrl: l.sourceUrl,
      vin: l.vin ?? null,
      make: l.make,
      model: l.model,
      trim: l.trim ?? null,
      year: l.year,
      price: l.price,
      currency: l.currency ?? 'TRY',
      mileageKm: l.mileageKm ?? null,
      fuelType: l.fuelType ?? null,
      transmission: l.transmission ?? null,
      bodyType: l.bodyType ?? null,
      color: l.color ?? null,
      city: l.city ?? null,
      district: l.district ?? null,
      sellerType: l.sellerType ?? null,
      imageUrl: l.imageUrl ?? null,
      imageUrls: Array.isArray(l.imageUrls)
        ? JSON.stringify(l.imageUrls)
        : typeof l.imageUrls === 'string' ? l.imageUrls : '[]',
      description: l.description ?? null,
      firstSeenAt: l.firstSeenAt ? new Date(l.firstSeenAt) : new Date(),
      lastSeenAt: l.lastSeenAt ? new Date(l.lastSeenAt) : new Date(),
      isActive: l.isActive ?? true,
      isDeleted: l.isDeleted ?? false,
      estimatedValue: l.estimatedValue ?? null,
      confidence: l.confidence ?? null,
      dealScore: l.dealScore ?? null,
      dealTag: l.dealTag ?? null,
      comparableCount: l.comparableCount ?? 0,
      annualDepreciationPercent: l.annualDepreciationPercent ?? null,
      annualDepreciationAmount: l.annualDepreciationAmount ?? null,
      ownershipCostAnnual: l.ownershipCostAnnual ?? null,
      fuelCostAnnual: l.fuelCostAnnual ?? null,
      insuranceCostAnnual: l.insuranceCostAnnual ?? null,
      maintenanceCostAnnual: l.maintenanceCostAnnual ?? null,
      taxCostAnnual: l.taxCostAnnual ?? null,
      fuelConsumptionCity: l.fuelConsumptionCity ?? null,
      fuelConsumptionHighway: l.fuelConsumptionHighway ?? null,
      fuelConsumptionCombined: l.fuelConsumptionCombined ?? null,
      fuelConsumptionUnit: l.fuelConsumptionUnit ?? 'L',
      fuelConsumptionSource: l.fuelConsumptionSource ?? 'factory',
      accidentStatus: l.accidentStatus ?? null,
      damageInfo: l.damageInfo ?? null,
    }));
    const result = await db.listing.createMany({ data: payload as any, skipDuplicates: true });
    inserted += result.count;
    process.stdout.write(`\r[seed] ${inserted}/${listings.length} inserted`);
  }
  console.log('');

  // Demo user
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash('demo1234', 10);
  await db.user.upsert({
    where: { email: 'demo@otodedektif.com' },
    update: {},
    create: { email: 'demo@otodedektif.com', name: 'Demo', passwordHash, role: 'admin' },
  });
  console.log('[seed] Demo user: demo@otodedektif.com / demo1234');
  console.log(`[seed] Done: ${inserted} listings`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
