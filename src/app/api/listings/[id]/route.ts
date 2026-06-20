import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ListingWithScore } from '@/lib/types';

// ── Helper: Transform DB listing to ListingWithScore ───────────────────

function transformListing(listing: Record<string, unknown>): ListingWithScore {
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
    imageUrls: JSON.parse((listing.imageUrls as string) || '[]') as string[],
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
  };
}

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const listing = await db.listing.findUnique({
      where: { id },
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'desc' },
        },
      },
    });

    if (!listing || listing.isDeleted) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 },
      );
    }

    // Transform the main listing
    const transformedListing = transformListing(listing);

    // Transform price history
    const priceHistory = listing.priceHistory.map((ph) => ({
      id: ph.id,
      price: ph.price,
      recordedAt: new Date(ph.recordedAt).toISOString(),
    }));

    // Find comparable listings (same make + model, within ±2 years)
    const comparables = await db.listing.findMany({
      where: {
        make: { equals: listing.make },
        model: { equals: listing.model },
        year: { gte: listing.year - 2, lte: listing.year + 2 },
        isActive: true,
        isDeleted: false,
        id: { not: id },
      },
      orderBy: { dealScore: 'desc' },
      take: 10,
    });

    const transformedComparables = comparables.map(transformListing);

    return NextResponse.json({
      listing: transformedListing,
      priceHistory,
      comparables: transformedComparables,
    });
  } catch (error) {
    console.error('[API /listings/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
