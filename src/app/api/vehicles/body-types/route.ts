import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/vehicles/body-types ────────────────────────────────────────
// DB'deki tüm kasa tiplerini ilan sayısıyla döner.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bodyTypes = await db.listing.groupBy({
      by: ['bodyType'],
      where: { isActive: true, bodyType: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { bodyType: 'desc' } },
    });

    return NextResponse.json({
      bodyTypes: bodyTypes
        .filter(b => b.bodyType && b.bodyType.trim())
        .map(b => ({
          bodyType: b.bodyType,
          count: b._count._all,
        })),
    });
  } catch (error) {
    console.error('[API /vehicles/body-types] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
