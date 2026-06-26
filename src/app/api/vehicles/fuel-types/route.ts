import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/vehicles/fuel-types ─────────────────────────────────────────
// DB'deki tüm yakıt tiplerini ilan sayısıyla döner.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const fuelTypes = await db.listing.groupBy({
      by: ['fuelType'],
      where: { isActive: true, fuelType: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { fuelType: 'desc' } },
    });

    return NextResponse.json({
      fuelTypes: fuelTypes
        .filter(f => f.fuelType && f.fuelType.trim())
        .map(f => ({
          fuelType: f.fuelType,
          count: f._count._all,
        })),
    });
  } catch (error) {
    console.error('[API /vehicles/fuel-types] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
