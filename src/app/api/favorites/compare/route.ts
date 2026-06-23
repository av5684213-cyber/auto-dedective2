import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { transformListing } from '@/lib/utils/transform-listing';
import { loadFallbackListings } from '@/lib/services/fallback-data';
import type { ListingWithScore } from '@/lib/types';

// ── POST /api/favorites/compare ────────────────────────────────────────
//
// Body:
//   { "ids": ["id1", "id2"] }   — 2 listing IDs to compare
//
// Returns:
//   {
//     "listings": [ListingWithScore, ListingWithScore],
//     "marketStats": {
//       "avgPrice": number,
//       "medianPrice": number,
//       "minPrice": number,
//       "maxPrice": number,
//       "count": number,
//       "make": string,
//       "model": string,
//       "yearRange": { min, max }
//     },
//     "comparison": {
//       "priceDifference": number,        // listing[1].price - listing[0].price
//       "priceDifferencePercent": number, // % difference
//       "cheaperListingIndex": 0 | 1,
//       "mileageDifference": number,      // listing[1].km - listing[0].km
//       "yearDifference": number,         // listing[1].year - listing[0].year
//       "marketComparison": [
//         {
//           "listingIndex": 0 | 1,
//           "priceVsMarket": number,      // % above/below market avg
//           "mileageVsMarket": number,    // % above/below market avg
//           "yearVsMarket": number,       // years above/below market avg
//           "verdict": string             // human-readable summary
//         },
//         ...
//       ]
//     }
//   }
//
// Auth: public (favorites are client-side, no token needed)

const compareBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(2).max(2),
});

async function getListingById(id: string): Promise<ListingWithScore | null> {
  // Try DB first
  try {
    const listing = await db.listing.findUnique({
      where: { id },
      include: { priceHistory: { orderBy: { recordedAt: 'desc' }, take: 10 } },
    });
    if (listing && !listing.isDeleted) {
      return transformListing(listing as unknown as Record<string, unknown>);
    }
  } catch (err) {
    console.warn(`[compare] DB lookup failed for ${id}:`, (err as Error).message);
  }

  // Fallback to static JSON
  const fallback = loadFallbackListings().find((l) => l.id === id);
  if (fallback) {
    return transformListing(fallback as unknown as Record<string, unknown>);
  }

  return null;
}

async function getMarketStats(make: string, model: string): Promise<{
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  count: number;
  make: string;
  model: string;
  yearRange: { min: number; max: number };
  avgMileage: number | null;
  avgYear: number | null;
}> {
  // Try DB
  let comparables: Array<{ price: number; mileageKm: number | null; year: number }> = [];

  try {
    comparables = await db.listing.findMany({
      where: {
        make: { equals: make },
        model: { equals: model },
        isActive: true,
        isDeleted: false,
      },
      select: { price: true, mileageKm: true, year: true },
    });
  } catch (err) {
    console.warn('[compare] Market stats DB query failed:', (err as Error).message);
  }

  // If DB returned nothing, try fallback
  if (comparables.length === 0) {
    const fallback = loadFallbackListings().filter((l) => l.make === make && l.model === model);
    comparables = fallback.map((l) => ({
      price: l.price,
      mileageKm: l.mileageKm ?? null,
      year: l.year,
    }));
  }

  if (comparables.length === 0) {
    return {
      avgPrice: 0, medianPrice: 0, minPrice: 0, maxPrice: 0,
      count: 0, make, model,
      yearRange: { min: 0, max: 0 },
      avgMileage: null, avgYear: null,
    };
  }

  const prices = comparables.map((c) => c.price).sort((a, b) => a - b);
  const years = comparables.map((c) => c.year);
  const mileages = comparables.filter((c) => c.mileageKm != null).map((c) => c.mileageKm as number);

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const medianPrice = prices.length % 2 !== 0
    ? prices[Math.floor(prices.length / 2)]
    : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;

  const avgYear = years.length > 0 ? years.reduce((a, b) => a + b, 0) / years.length : null;
  const avgMileage = mileages.length > 0 ? mileages.reduce((a, b) => a + b, 0) / mileages.length : null;

  return {
    avgPrice: Math.round(avgPrice),
    medianPrice: Math.round(medianPrice),
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
    count: comparables.length,
    make, model,
    yearRange: { min: Math.min(...years), max: Math.max(...years) },
    avgMileage: avgMileage ? Math.round(avgMileage) : null,
    avgYear: avgYear ? Math.round(avgYear) : null,
  };
}

function buildVerdict(
  listing: ListingWithScore,
  market: Awaited<ReturnType<typeof getMarketStats>>,
): string {
  if (market.count === 0) return 'Piyasa verisi yetersiz';

  const priceDiff = ((listing.price - market.avgPrice) / market.avgPrice) * 100;
  const parts: string[] = [];

  if (priceDiff < -10) parts.push(`piyasa ortalamasının %${Math.abs(priceDiff).toFixed(0)} altında (ucuz)`);
  else if (priceDiff > 10) parts.push(`piyasa ortalamasının %${priceDiff.toFixed(0)} üstünde (pahalı)`);
  else parts.push('piyasa ortalamasına yakın');

  if (market.avgMileage && listing.mileageKm) {
    const kmDiff = ((listing.mileageKm - market.avgMileage) / market.avgMileage) * 100;
    if (kmDiff < -20) parts.push(`%${Math.abs(kmDiff).toFixed(0)} daha az km`);
    else if (kmDiff > 20) parts.push(`%${kmDiff.toFixed(0)} daha fazla km`);
  }

  if (market.avgYear && listing.year) {
    const yearDiff = listing.year - market.avgYear;
    if (yearDiff > 0) parts.push(`${yearDiff} yıl daha yeni`);
    else if (yearDiff < 0) parts.push(`${Math.abs(yearDiff)} yıl daha eski`);
  }

  return parts.join(', ');
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = compareBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const [id1, id2] = parseResult.data.ids;

    // Fetch both listings in parallel
    const [listing1, listing2] = await Promise.all([
      getListingById(id1),
      getListingById(id2),
    ]);

    if (!listing1) {
      return NextResponse.json(
        { error: `Listing not found: ${id1}` },
        { status: 404 },
      );
    }
    if (!listing2) {
      return NextResponse.json(
        { error: `Listing not found: ${id2}` },
        { status: 404 },
      );
    }

    // Get market stats (use the first listing's make+model as reference)
    const marketStats = await getMarketStats(listing1.make, listing1.model);

    // Compute pairwise comparison
    const priceDifference = listing2.price - listing1.price;
    const priceDifferencePercent = listing1.price > 0
      ? (priceDifference / listing1.price) * 100
      : 0;
    const cheaperListingIndex = priceDifference > 0 ? 0 : 1; // if listing2 is more expensive, listing1 is cheaper

    const mileage1 = listing1.mileageKm ?? 0;
    const mileage2 = listing2.mileageKm ?? 0;
    const mileageDifference = mileage2 - mileage1;

    const yearDifference = listing2.year - listing1.year;

    // Market comparison for each listing
    const marketComparison = [
      {
        listingIndex: 0,
        priceVsMarket: marketStats.avgPrice > 0
          ? ((listing1.price - marketStats.avgPrice) / marketStats.avgPrice) * 100
          : 0,
        mileageVsMarket: (marketStats.avgMileage && listing1.mileageKm)
          ? ((listing1.mileageKm - marketStats.avgMileage) / marketStats.avgMileage) * 100
          : null,
        yearVsMarket: marketStats.avgYear
          ? listing1.year - marketStats.avgYear
          : null,
        verdict: buildVerdict(listing1, marketStats),
      },
      {
        listingIndex: 1,
        priceVsMarket: marketStats.avgPrice > 0
          ? ((listing2.price - marketStats.avgPrice) / marketStats.avgPrice) * 100
          : 0,
        mileageVsMarket: (marketStats.avgMileage && listing2.mileageKm)
          ? ((listing2.mileageKm - marketStats.avgMileage) / marketStats.avgMileage) * 100
          : null,
        yearVsMarket: marketStats.avgYear
          ? listing2.year - marketStats.avgYear
          : null,
        verdict: buildVerdict(listing2, marketStats),
      },
    ];

    return NextResponse.json({
      listings: [listing1, listing2],
      marketStats,
      comparison: {
        priceDifference,
        priceDifferencePercent,
        cheaperListingIndex,
        mileageDifference,
        yearDifference,
        marketComparison,
      },
    });
  } catch (error) {
    console.error('[API /favorites/compare] Error:', error);
    return NextResponse.json(
      { error: 'Comparison failed' },
      { status: 500 },
    );
  }
}
