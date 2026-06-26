import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// ── GET /api/telegram/status ────────────────────────────────────────────
//
// Kullanıcının Telegram bağlantı durumunu döner.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const conn = await db.telegramConnection.findUnique({
      where: { userId: session.user.id },
      select: {
        chatId: true,
        username: true,
        firstName: true,
        connectedAt: true,
      },
    });

    return NextResponse.json({
      connected: !!conn,
      connection: conn,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
    });
  } catch (error) {
    console.error('[API /telegram/status] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// ── DELETE /api/telegram/status ─────────────────────────────────────────
//
// Telegram bağlantısını kaldır.

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    await db.telegramConnection.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /telegram/status DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
