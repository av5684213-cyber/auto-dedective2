import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ListingWithScore } from '@/lib/types';
import { transformListing } from '@/lib/utils/transform-listing';
import { loadFallbackListings } from '@/lib/services/fallback-data';

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let listing: any = null;
    try {
      listing = await db.listing.findUnique({
        where: { id },
        include: { priceHistory: { orderBy: { recordedAt: 'desc' } } },
      });
    } catch (err) {
      console.warn('[API /listings/[id]] DB error, trying fallback:', (err as Error).message);
    }

    if (!listing || listing.isDeleted) {
      const fallback = loadFallbackListings().find((l) => l.id === id);
      if (fallback) {
        const comparables = loadFallbackListings()
          .filter((l) => l.id !== id && l.make === fallback.make && l.model === fallback.model && l.year >= fallback.year - 2 && l.year <= fallback.year + 2)
          .slice(0, 10)
          .map((l) => transformListing(l as unknown as Record<string, unknown>));

        return NextResponse.json({
          listing: transformListing(fallback as unknown as Record<string, unknown>),
          priceHistory: fallback.priceHistory || [],
          comparables,
          _fallback: true,
        });
      }

      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const transformedListing = transformListing(listing as unknown as Record<string, unknown>);
    const priceHistory = listing.priceHistory.map((ph: any) => ({
      id: ph.id, price: ph.price,
      recordedAt: new Date(ph.recordedAt).toISOString(),
    }));

    let comparables: any[] = [];
    try {
      comparables = await db.listing.findMany({
        where: {
          make: { equals: listing.make }, model: { equals: listing.model },
          year: { gte: listing.year - 2, lte: listing.year + 2 },
          isActive: true, isDeleted: false, id: { not: id },
        },
        orderBy: { dealScore: 'desc' }, take: 10,
      });
    } catch (err) {
      console.warn('[API /listings/[id]] comparables DB error:', (err as Error).message);
    }

    const transformedComparables = comparables.map((l) => transformListing(l as unknown as Record<string, unknown>));

    return NextResponse.json({
      listing: transformedListing, priceHistory, comparables: transformedComparables,
    });
  } catch (error) {
    console.error('[API /listings/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 });
  }
}
