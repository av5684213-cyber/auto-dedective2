import type { ListingWithScore } from '@/lib/types';

// ── Safe JSON parse helper ──────────────────────────────────────────────

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

// ── transformListing: DB row → API ListingWithScore ────────────────────

export function transformListing(listing: Record<string, unknown>): ListingWithScore {
  return {
    id: listing.id as string,
    sourceName: listing.sourceName as string,
    sourceUrl: listing.sourceUrl as string,
    make: listing.make as string,
    model: listing.model as string,
    trim: (listing.trim as string) || null,
    year: listing.year as number,
    price: listing.price as number,
    mileageKm: (listing.mileageKm as number) ?? null,
    fuelType: (listing.fuelType as string) || null,
    transmission: (listing.transmission as string) || null,
    bodyType: (listing.bodyType as string) || null,
    color: (listing.color as string) || null,
    city: (listing.city as string) || null,
    district: (listing.district as string) || null,
    sellerType: (listing.sellerType as string) || null,
    imageUrl: (listing.imageUrl as string) || null,
    imageUrls: safeJsonParse<string[]>(
      (listing.imageUrls as string) || '[]',
      [],
    ),
    description: (listing.description as string) || null,
    firstSeenAt: new Date(listing.firstSeenAt as string | Date).toISOString(),
    lastSeenAt: new Date(listing.lastSeenAt as string | Date).toISOString(),
    estimatedValue: (listing.estimatedValue as number) ?? null,
    confidence: (listing.confidence as string) || null,
    dealScore: (listing.dealScore as number) ?? null,
    dealTag: (listing.dealTag as string) || null,
    comparableCount: (listing.comparableCount as number) ?? 0,
    annualDepreciationPercent: (listing.annualDepreciationPercent as number) ?? null,
    annualDepreciationAmount: (listing.annualDepreciationAmount as number) ?? null,
    ownershipCostAnnual: (listing.ownershipCostAnnual as number) ?? null,
    fuelCostAnnual: (listing.fuelCostAnnual as number) ?? null,
    insuranceCostAnnual: (listing.insuranceCostAnnual as number) ?? null,
    maintenanceCostAnnual: (listing.maintenanceCostAnnual as number) ?? null,
    taxCostAnnual: (listing.taxCostAnnual as number) ?? null,
    fuelConsumptionCity: (listing.fuelConsumptionCity as number) ?? null,
    fuelConsumptionHighway: (listing.fuelConsumptionHighway as number) ?? null,
    fuelConsumptionCombined: (listing.fuelConsumptionCombined as number) ?? null,
    fuelConsumptionUnit: (listing.fuelConsumptionUnit as string) ?? null,
    fuelConsumptionSource: (listing.fuelConsumptionSource as string) ?? null,
  };
}
