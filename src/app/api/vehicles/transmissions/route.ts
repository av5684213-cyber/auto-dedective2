import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/vehicles/transmissions ─────────────────────────────────────
// DB'deki tüm vites tiplerini ilan sayısıyla döner.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const transmissions = await db.listing.groupBy({
      by: ['transmission'],
      where: { isActive: true, transmission: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { transmission: 'desc' } },
    });

    return NextResponse.json({
      transmissions: transmissions
        .filter(t => t.transmission && t.transmission.trim())
        .map(t => ({
          transmission: t.transmission,
          count: t._count._all,
        })),
    });
  } catch (error) {
    console.error('[API /vehicles/transmissions] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
