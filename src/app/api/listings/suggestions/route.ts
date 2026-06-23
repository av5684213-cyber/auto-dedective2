import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/services/cache';
import { suggestionsQuerySchema, safeParse } from '@/lib/validation/schemas';

// ── Turkish-aware search normalization ──────────────────────────────────

function normalizeTurkishForSearch(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c');
}

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const raw: Record<string, string> = {};
    for (const key of searchParams.keys()) {
      const value = searchParams.get(key);
      if (value !== null) raw[key] = value;
    }

    const parsed = safeParse(suggestionsQuerySchema, raw, { q: '' }, 'suggestionsQuery');
    const q = normalizeTurkishForSearch(parsed.q || '');

    if (!q || q.length < 1) {
      return NextResponse.json({ makes: [], models: [] });
    }

    const cacheKey = `suggestions:${q}`;
    const cached = await cache.get<{ makes: string[]; models: string[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    let makeResults: any[] = [];
    let modelResults: any[] = [];
    let makeStartsWith: any[] = [];
    let modelStartsWith: any[] = [];

    try {
      [makeResults, modelResults, makeStartsWith, modelStartsWith] = await Promise.all([
        db.listing.findMany({
          where: { isActive: true, isDeleted: false, make: { contains: q } },
          select: { make: true }, distinct: ['make'], take: 10,
        }),
        db.listing.findMany({
          where: { isActive: true, isDeleted: false, model: { contains: q } },
          select: { model: true, make: true }, distinct: ['model', 'make'], take: 10,
        }),
        db.listing.findMany({
          where: { isActive: true, isDeleted: false, make: { startsWith: q } },
          select: { make: true }, distinct: ['make'], take: 10,
        }),
        db.listing.findMany({
          where: { isActive: true, isDeleted: false, model: { startsWith: q } },
          select: { model: true, make: true }, distinct: ['model', 'make'], take: 10,
        }),
      ]);
    } catch (err) {
      console.warn('[API /listings/suggestions] DB error:', (err as Error).message);
      return NextResponse.json({ makes: [], models: [] });
    }

    const makesSet = new Set<string>();
    for (const r of [...makeResults, ...makeStartsWith]) makesSet.add(r.make);
    const makes = Array.from(makesSet).sort((a, b) => a.localeCompare(b, 'tr-TR')).slice(0, 10);

    const modelsMap = new Map<string, { model: string; make: string }>();
    for (const r of [...modelResults, ...modelStartsWith]) {
      const key = `${r.make}|${r.model}`;
      if (!modelsMap.has(key)) modelsMap.set(key, { model: r.model, make: r.make });
    }
    const models = Array.from(modelsMap.values()).sort((a, b) => a.model.localeCompare(b.model, 'tr-TR')).slice(0, 10);

    const result = { makes, models };
    await cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /listings/suggestions] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
