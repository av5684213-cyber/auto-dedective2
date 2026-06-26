import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/vehicles/trims?make=BMW&model=3+serisi+320i+m+sport ─────────
//
// Verilen marka+model kombinasyonuna ait trim'leri döner.
// Alert kurma ekranında motor/trim dropdown'ı doldurur.
// ?make=BMW&model=3 serisi 320i m sport → o modelin trim'leri

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const make = searchParams.get('make')?.trim();
    const model = searchParams.get('model')?.trim();
    const q = searchParams.get('q')?.trim().toLowerCase();

    if (!make || !model) {
      return NextResponse.json(
        { error: 'make ve model parametreleri gerekli' },
        { status: 400 }
      );
    }

    const where: any = {
      isActive: true,
      make: { equals: make, mode: 'insensitive' },
      model: { equals: model, mode: 'insensitive' },
      trim: { not: null },
    };
    if (q) {
      where.trim = { contains: q, mode: 'insensitive' };
    }

    const trims = await db.listing.groupBy({
      by: ['trim'],
      where,
      _count: { _all: true },
      orderBy: { _count: { trim: 'desc' } },
      take: 50,
    });

    return NextResponse.json({
      make,
      model,
      trims: trims
        .filter(t => t.trim && t.trim.trim())
        .map(t => ({
          trim: t.trim,
          count: t._count._all,
        })),
    });
  } catch (error) {
    console.error('[API /vehicles/trims] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
