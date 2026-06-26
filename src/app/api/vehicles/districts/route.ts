import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/vehicles/districts?city=İstanbul ───────────────────────────
// Verilen şehre ait ilçeleri döner. Alert kurma ekranında ilçe dropdown'ı için.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city')?.trim();

    if (!city) {
      return NextResponse.json(
        { error: 'city parametresi gerekli' },
        { status: 400 }
      );
    }

    const districts = await db.listing.groupBy({
      by: ['district'],
      where: {
        isActive: true,
        city: { equals: city, mode: 'insensitive' },
        district: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { district: 'desc' } },
    });

    return NextResponse.json({
      city,
      districts: districts
        .filter(d => d.district && d.district.trim())
        .map(d => ({
          district: d.district,
          count: d._count._all,
        })),
    });
  } catch (error) {
    console.error('[API /vehicles/districts] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
