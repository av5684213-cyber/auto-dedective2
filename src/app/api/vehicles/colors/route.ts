import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/vehicles/colors ─────────────────────────────────────────────
// DB'deki tüm renkleri ilan sayısıyla döner.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const colors = await db.listing.groupBy({
      by: ['color'],
      where: { isActive: true, color: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { color: 'desc' } },
    });

    return NextResponse.json({
      colors: colors
        .filter(c => c.color && c.color.trim())
        .map(c => ({
          color: c.color,
          count: c._count._all,
        })),
    });
  } catch (error) {
    console.error('[API /vehicles/colors] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
