import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { transformListing } from '@/lib/utils/transform-listing';
import { loadFallbackListings } from '@/lib/services/fallback-data';

// ── POST /api/favorites ────────────────────────────────────────────────
//
// Body:
//   { "ids": ["id1", "id2", ...] }   — favorite listing IDs
//
// Returns:
//   { "listings": ListingWithScore[] }
//
// Auth: public (favorites are client-side, no token needed)

const favoritesBodySchema = z.object({
  ids: z.array(z.string().min(1)).max(50),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = favoritesBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const ids = parseResult.data.ids;

    if (ids.length === 0) {
      return NextResponse.json({ listings: [] });
    }

    // Try DB first
    let dbListings: any[] = [];
    try {
      dbListings = await db.listing.findMany({
        where: { id: { in: ids }, isActive: true, isDeleted: false },
      });
    } catch (err) {
      console.warn('[favorites] DB query failed, using fallback:', (err as Error).message);
    }

    // Build a map of found listings
    const foundMap = new Map<string, any>();
    for (const listing of dbListings) {
      foundMap.set(listing.id, listing);
    }

    // For IDs not found in DB, try fallback
    const fallbackListings = loadFallbackListings();
    const missingIds = ids.filter((id) => !foundMap.has(id));
    for (const id of missingIds) {
      const fallback = fallbackListings.find((l) => l.id === id);
      if (fallback) {
        foundMap.set(id, fallback);
      }
    }

    // Preserve the order of input IDs
    const listings = ids
      .map((id) => foundMap.get(id))
      .filter((l) => l !== undefined)
      .map((l) => transformListing(l as unknown as Record<string, unknown>));

    return NextResponse.json({ listings });
  } catch (error) {
    console.error('[API /favorites] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 },
    );
  }
}
