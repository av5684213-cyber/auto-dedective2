import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// ── POST /api/telegram/connect ──────────────────────────────────────────
//
// Kullanıcı bu endpoint'i çağırınca, kendi user ID'sine özel bir bağlantı
// deep-link'i alır: https://t.me/<BOT_USERNAME>?start=<userId>
//
// Kullanıcı bu linke tıklayınca Telegram açılır, bot /start <userId> komutu
// çalıştırır, webhook buraya kaydeder (bkz /api/telegram/webhook).

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
      return NextResponse.json({
        ok: false,
        error: 'TELEGRAM_BOT_USERNAME env tanımlı değil',
      }, { status: 500 });
    }

    // Zaten bağlı mı?
    const existing = await db.telegramConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyConnected: true,
        connection: {
          chatId: existing.chatId,
          username: existing.username,
          firstName: existing.firstName,
          connectedAt: existing.connectedAt,
        },
      });
    }

    // Deep link — t.me/<bot>?start=<userId>
    const startParam = session.user.id;
    const link = `https://t.me/${botUsername}?start=${startParam}`;

    return NextResponse.json({
      ok: true,
      alreadyConnected: false,
      link,
      instructions: [
        `1. Yukarıdaki linke tıklayın — Telegram açılacak`,
        `2. @${botUsername} bot'una otomatik /start komutu gönderilecek`,
        `3. Bot sizi tanıyıp bağlantınızı tamamlayacak`,
        `4. Bu sayfayı yenileyin — bağlantı aktif olacak`,
      ],
    });
  } catch (error) {
    console.error('[API /telegram/connect] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
