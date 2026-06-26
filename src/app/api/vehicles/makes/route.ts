import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/vehicles/makes ─────────────────────────────────────────────
//
// DB'deki tüm markaları ilan sayısıyla birlikte döner.
// Alert kurma ekranında marka dropdown'ı doldurur.
// Public endpoint (auth gerekmez) — tüm ilanlardan beslenir.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const makes = await db.listing.groupBy({
      by: ['make'],
      where: { isActive: true },
      _count: { _all: true },
      orderBy: { _count: { make: 'desc' } },
    });

    return NextResponse.json({
      makes: makes.map(m => ({
        make: m.make,
        count: m._count._all,
      })),
      total: makes.length,
    });
  } catch (error) {
    console.error('[API /vehicles/makes] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
