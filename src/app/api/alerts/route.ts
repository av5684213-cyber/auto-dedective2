import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

// ── POST /api/alerts — Kaydet ───────────────────────────────────────────
// ── GET /api/alerts — Listele ───────────────────────────────────────────
// ── DELETE /api/alerts?id=xxx — Sil ─────────────────────────────────────

const createAlertSchema = z.object({
  name: z.string().min(3, 'İsim en az 3 karakter').max(100),
  filters: z.object({
    // Marka/model — tek veya çoklu seçim
    make: z.union([z.string(), z.array(z.string())]).optional(),
    model: z.union([z.string(), z.array(z.string())]).optional(),
    trim: z.string().optional(),
    // Sayısal aralıklar
    yearMin: z.coerce.number().int().min(1900).max(2100).optional(),
    yearMax: z.coerce.number().int().min(1900).max(2100).optional(),
    priceMin: z.coerce.number().min(0).optional(),
    priceMax: z.coerce.number().min(0).optional(),
    mileageMin: z.coerce.number().int().min(0).optional(),
    mileageMax: z.coerce.number().int().min(0).optional(),
    // Kategorik — tek veya çoklu
    fuelType: z.union([z.string(), z.array(z.string())]).optional(),
    transmission: z.union([z.string(), z.array(z.string())]).optional(),
    bodyType: z.union([z.string(), z.array(z.string())]).optional(),
    color: z.union([z.string(), z.array(z.string())]).optional(),
    colorExclude: z.union([z.string(), z.array(z.string())]).optional(),
    city: z.union([z.string(), z.array(z.string())]).optional(),
    district: z.union([z.string(), z.array(z.string())]).optional(),
    sellerType: z.union([z.string(), z.array(z.string())]).optional(),
    accidentStatus: z.union([z.string(), z.array(z.string())]).optional(),
    dealTag: z.union([z.string(), z.array(z.string())]).optional(),
    // Skor
    dealScoreMin: z.coerce.number().min(0).max(5).optional(),
  }),
  // Yeni: çoklu kanal seçimi
  channels: z.array(z.enum(['email', 'push', 'telegram'])).min(1, 'En az 1 kanal seçin').default(['email', 'push']),
  // Backward compat (eski UI'dan gelen istekler için)
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const [alerts, telegramConn, pushCount] = await Promise.all([
      db.savedSearch.findMany({
        where: { userId: session.user.id, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.telegramConnection.findUnique({
        where: { userId: session.user.id },
        select: { chatId: true, username: true, firstName: true, connectedAt: true },
      }),
      db.pushSubscription.count({ where: { userId: session.user.id } }),
    ]);

    return NextResponse.json({
      alerts,
      channels: {
        email: session.user.email,
        push: { subscribed: pushCount > 0, count: pushCount },
        telegram: telegramConn,
      },
    });
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

    const { name, filters, channels, notifyEmail, notifyPush } = parseResult.data;

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

    // Eski alanlar backward-compat için
    const emailFlag = notifyEmail ?? channels.includes('email');
    const pushFlag = notifyPush ?? channels.includes('push');

    // channels'ı comma-separated string olarak sakla (DB default formatıyla uyumlu)
    const channelsStr = Array.isArray(channels) ? channels.join(',') : String(channels)

    const alert = await db.savedSearch.create({
      data: {
        userId: session.user.id,
        name,
        filters: JSON.stringify(filters),
        channels: channelsStr,
        notifyEmail: emailFlag,
        notifyPush: pushFlag,
      },
    });

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error('[API /alerts POST] Error:', error);
    return NextResponse.json({ error: 'Kayıt başarısız' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, channels, name, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID gerekli' }, { status: 400 });
    }

    // Sadece kendi alert'ini güncelleyebilir
    const existing = await db.savedSearch.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }

    const data: any = {};
    if (name) data.name = name;
    if (channels) {
      data.channels = Array.isArray(channels) ? channels.join(',') : String(channels);
      data.notifyEmail = channels.includes('email');
      data.notifyPush = channels.includes('push');
    }
    if (typeof isActive === 'boolean') data.isActive = isActive;

    const updated = await db.savedSearch.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, alert: updated });
  } catch (error) {
    console.error('[API /alerts PATCH] Error:', error);
    return NextResponse.json({ error: 'Güncelleme başarısız' }, { status: 500 });
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

    // Sadece kendi alert'ini silebilir (soft delete — isActive=false)
    await db.savedSearch.updateMany({
      where: { id, userId: session.user.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /alerts DELETE] Error:', error);
    return NextResponse.json({ error: 'Silme başarısız' }, { status: 500 });
  }
}
