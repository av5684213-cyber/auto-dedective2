import { db } from '@/lib/db';
import { writeFileSync } from 'fs';

async function main() {
  console.log('Exporting to data/letgo-listings.json ...');
  const listings = await db.listing.findMany({
    where: { isActive: true, isDeleted: false },
    include: { priceHistory: { orderBy: { recordedAt: 'desc' }, take: 20 } },
    orderBy: { lastSeenAt: 'desc' },
  });
  const out = listings.map((l: any) => ({
    id: l.id, sourceName: l.sourceName, sourceUrl: l.sourceUrl,
    vin: l.vin ?? null, make: l.make, model: l.model, trim: l.trim ?? null,
    year: l.year, price: l.price, currency: l.currency ?? 'TRY',
    mileageKm: l.mileageKm ?? null, fuelType: l.fuelType ?? null,
    transmission: l.transmission ?? null, bodyType: l.bodyType ?? null,
    color: l.color ?? null, city: l.city ?? null, district: l.district ?? null,
    sellerType: l.sellerType ?? null, imageUrl: l.imageUrl ?? null,
    imageUrls: (() => {
      if (Array.isArray(l.imageUrls)) return l.imageUrls;
      if (typeof l.imageUrls === 'string') { try { return JSON.parse(l.imageUrls); } catch { return []; } }
      return [];
    })(),
    description: l.description ?? null,
    firstSeenAt: l.firstSeenAt instanceof Date ? l.firstSeenAt.toISOString() : l.firstSeenAt,
    lastSeenAt: l.lastSeenAt instanceof Date ? l.lastSeenAt.toISOString() : l.lastSeenAt,
    isActive: l.isActive, isDeleted: l.isDeleted,
    estimatedValue: l.estimatedValue ?? null, confidence: l.confidence ?? null,
    dealScore: l.dealScore ?? null, dealTag: l.dealTag ?? null,
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
    accidentStatus: l.accidentStatus ?? null, damageInfo: l.damageInfo ?? null,
    priceHistory: (l.priceHistory || []).map((ph: any) => ({
      id: ph.id, price: ph.price,
      recordedAt: ph.recordedAt instanceof Date ? ph.recordedAt.toISOString() : ph.recordedAt,
    })),
  }));
  const deg = out.filter((l: any) => l.dealTag === 'Değerlendirilemedi').length;
  console.log(`Değerlendirilemedi count: ${deg}`);
  writeFileSync('data/letgo-listings.json', JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} listings to data/letgo-listings.json`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
