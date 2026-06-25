import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import type { SearchFilters } from '@/lib/types';

// ── POST /api/alerts — Kaydet ───────────────────────────────────────────
// ── GET /api/alerts — Listele ───────────────────────────────────────────
// ── DELETE /api/alerts?id=xxx — Sil ─────────────────────────────────────

const createAlertSchema = z.object({
  name: z.string().min(3, 'İsim en az 3 karakter').max(100),
  filters: z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    yearMin: z.coerce.number().int().min(1900).max(2100).optional(),
    yearMax: z.coerce.number().int().min(1900).max(2100).optional(),
    priceMin: z.coerce.number().min(0).optional(),
    priceMax: z.coerce.number().min(0).optional(),
    mileageMax: z.coerce.number().int().min(0).optional(),
    fuelType: z.string().optional(),
    transmission: z.string().optional(),
    bodyType: z.string().optional(),
    city: z.string().optional(),
    sellerType: z.string().optional(),
    dealTag: z.string().optional(),
  }),
  notifyEmail: z.boolean().default(true),
  notifyPush: z.boolean().default(true),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const alerts = await db.savedSearch.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[API /alerts GET] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = createAlertSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Geçersiz giriş' },
        { status: 400 },
      );
    }

    const { name, filters, notifyEmail, notifyPush } = parseResult.data;

    // Kullanıcı en fazla 10 alert kaydedebilir
    const count = await db.savedSearch.count({
      where: { userId: session.user.id, isActive: true },
    });
    if (count >= 10) {
      return NextResponse.json(
        { error: 'En fazla 10 alarm kaydedebilirsiniz' },
        { status: 400 },
      );
    }

    const alert = await db.savedSearch.create({
      data: {
        userId: session.user.id,
        name,
        filters: JSON.stringify(filters),
        notifyEmail,
        notifyPush,
      },
    });

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error('[API /alerts POST] Error:', error);
    return NextResponse.json({ error: 'Kayıt başarısız' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID gerekli' }, { status: 400 });
    }

    // Sadece kendi alert'ini silebilir
    await db.savedSearch.deleteMany({
      where: { id, userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /alerts DELETE] Error:', error);
    return NextResponse.json({ error: 'Silme başarısız' }, { status: 500 });
  }
}
