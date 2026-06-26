import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/listings/debug ──────────────────────────────────────────────
//
// Geçici debug endpoint — /api/listings route'unun DB sorgusunu test eder.
// Hangi where clause üretildiğini ve DB'den ne döndüğünü gösterir.
// Auth: ADMIN_TOKEN ile korunur.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') || '';
  const expected = process.env.ADMIN_TOKEN || process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const make = searchParams.get('make') || undefined;
  const model = searchParams.get('model') || undefined;
  const q = searchParams.get('q') || undefined;

  const filters: any = { isActive: true, isDeleted: false };

  if (make) {
    // Test 1: equals mode insensitive
    filters.make = { equals: make, mode: 'insensitive' };
  }
  if (model) {
    filters.model = { contains: model, mode: 'insensitive' };
  }
  if (q) {
    filters.OR = [
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { trim: { contains: q, mode: 'insensitive' } },
    ];
  }

  const result: any = {
    input: { make, model, q },
    filters,
    tests: {},
  };

  // Test 1: Basit count (where ile)
  try {
    const count = await db.listing.count({ where: filters });
    result.tests.countWithFilters = count;
  } catch (e: any) {
    result.tests.countWithFiltersError = e.message;
  }

  // Test 2: Sadece isActive
  try {
    const countAll = await db.listing.count({ where: { isActive: true } });
    result.tests.countAllActive = countAll;
  } catch (e: any) {
    result.tests.countAllActiveError = e.message;
  }

  // Test 3: make equals insensitive
  if (make) {
    try {
      const countMake = await db.listing.count({
        where: { isActive: true, make: { equals: make, mode: 'insensitive' } },
      });
      result.tests.countMakeInsensitive = countMake;
    } catch (e: any) {
      result.tests.countMakeInsensitiveError = e.message;
    }
  }

  // Test 4: make contains insensitive
  if (make) {
    try {
      const countMakeContains = await db.listing.count({
        where: { isActive: true, make: { contains: make, mode: 'insensitive' } },
      });
      result.tests.countMakeContains = countMakeContains;
    } catch (e: any) {
      result.tests.countMakeContainsError = e.message;
    }
  }

  // Test 5: model contains
  if (model) {
    try {
      const countModel = await db.listing.count({
        where: { isActive: true, model: { contains: model, mode: 'insensitive' } },
      });
      result.tests.countModelContains = countModel;
    } catch (e: any) {
      result.tests.countModelContainsError = e.message;
    }
  }

  // Test 6: q OR
  if (q) {
    try {
      const countQ = await db.listing.count({
        where: {
          isActive: true,
          OR: [
            { make: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
            { trim: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
      result.tests.countQ = countQ;
    } catch (e: any) {
      result.tests.countQError = e.message;
    }
  }

  return NextResponse.json(result, { status: 200 });
}
