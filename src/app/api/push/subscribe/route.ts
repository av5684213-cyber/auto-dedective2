import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

// ── POST /api/push/subscribe ────────────────────────────────────────────
//
// Tarayıcı service worker'dan gelen push subscription'ı DB'ye kaydet.
// Aynı endpoint varsa update eder, yoksa insert.

export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().or(z.string().min(10)),
    keys: z.object({
      p256dh: z.string().min(10),
      auth: z.string().min(10),
    }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz subscription' }, { status: 400 });
    }

    const { endpoint, keys } = parsed.data.subscription;
    const userAgent = req.headers.get('user-agent') || undefined;

    // Upsert — aynı endpoint varsa güncelle
    const existing = await db.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (existing) {
      await db.pushSubscription.update({
        where: { endpoint },
        data: {
          userId: session.user.id,
          p256dhKey: keys.p256dh,
          authKey: keys.auth,
          userAgent,
        },
      });
      return NextResponse.json({ success: true, action: 'updated' });
    }

    await db.pushSubscription.create({
      data: {
        userId: session.user.id,
        endpoint,
        p256dhKey: keys.p256dh,
        authKey: keys.auth,
        userAgent,
      },
    });

    return NextResponse.json({ success: true, action: 'created' });
  } catch (error) {
    console.error('[API /push/subscribe] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');

    if (endpoint) {
      await db.pushSubscription.deleteMany({
        where: { endpoint, userId: session.user.id },
      });
    } else {
      // Tümünü sil
      await db.pushSubscription.deleteMany({
        where: { userId: session.user.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /push/subscribe DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
