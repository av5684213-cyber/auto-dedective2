import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/services/cache';

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim().toLowerCase() || '';

    if (!q || q.length < 1) {
      return NextResponse.json({ makes: [], models: [] });
    }

    // Check cache
    const cacheKey = `suggestions:${q}`;
    const cached = await cache.get<{ makes: string[]; models: string[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Query distinct makes and models from active listings
    const [makeResults, modelResults] = await Promise.all([
      db.listing.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          make: { contains: q },
        },
        select: { make: true },
        distinct: ['make'],
        take: 10,
      }),
      db.listing.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          model: { contains: q },
        },
        select: { model: true, make: true },
        distinct: ['model', 'make'],
        take: 10,
      }),
    ]);

    // Also try matching by make name starting with query
    const [makeStartsWith, modelStartsWith] = await Promise.all([
      db.listing.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          make: { startsWith: q },
        },
        select: { make: true },
        distinct: ['make'],
        take: 10,
      }),
      db.listing.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          model: { startsWith: q },
        },
        select: { model: true, make: true },
        distinct: ['model', 'make'],
        take: 10,
      }),
    ]);

    // Merge and deduplicate makes
    const makesSet = new Set<string>();
    for (const r of [...makeResults, ...makeStartsWith]) {
      makesSet.add(r.make);
    }
    const makes = Array.from(makesSet)
      .sort((a, b) => a.localeCompare(b, 'tr-TR'))
      .slice(0, 10);

    // Merge and deduplicate models (include make for context)
    const modelsMap = new Map<string, { model: string; make: string }>();
    for (const r of [...modelResults, ...modelStartsWith]) {
      const key = `${r.make}|${r.model}`;
      if (!modelsMap.has(key)) {
        modelsMap.set(key, { model: r.model, make: r.make });
      }
    }
    const models = Array.from(modelsMap.values())
      .sort((a, b) => a.model.localeCompare(b.model, 'tr-TR'))
      .slice(0, 10);

    const result = { makes, models };

    // Cache for 5 minutes
    await cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /listings/suggestions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
