import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/vehicles/models?make=BMW ───────────────────────────────────
//
// Verilen markaya ait tüm modelleri ilan sayısıyla birlikte döner.
// Alert kurma ekranında model dropdown'ı doldurur (marka seçilince çağrılır).
// ?make=BMW → BMW modelleri
// ?make=BMW&q=320 → BMW modelleri içinde "320" geçenler

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const make = searchParams.get('make')?.trim();
    const q = searchParams.get('q')?.trim().toLowerCase();

    if (!make) {
      return NextResponse.json(
        { error: 'make parametresi gerekli' },
        { status: 400 }
      );
    }

    const where: any = { isActive: true, make: { equals: make, mode: 'insensitive' } };
    if (q) {
      where.model = { contains: q, mode: 'insensitive' };
    }

    const models = await db.listing.groupBy({
      by: ['model'],
      where,
      _count: { _all: true },
      orderBy: { _count: { model: 'desc' } },
      take: 100, // marka başına max 100 model
    });

    return NextResponse.json({
      make,
      models: models.map(m => ({
        model: m.model,
        count: m._count._all,
      })),
      total: models.length,
    });
  } catch (error) {
    console.error('[API /vehicles/models] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
