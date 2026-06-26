import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendRawMessage } from '@/lib/notifications/telegram';

// ── POST /api/telegram/webhook ──────────────────────────────────────────
//
// Telegram bot webhook endpoint'i.
// Kullanıcı bot'a /start <userId> gönderince chat_id'yi DB'ye kaydeder.
//
// TELEGRAM_WEBHOOK_SECRET ile korumalı — sadece Telegram'ın bilmemesi gereken
// bir URL path'i veya header ile doğrulama yapılır.
//
// Telegram bot kurulumu (manuel):
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://auto-dedective2.vercel.app/api/telegram/webhook"
//
// Veya NGROK/lokal test için getUpdates kullanılabilir.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Bot token yok' }, { status: 500 });
    }

    // Webhook secret kontrolü (opsiyonel — Telegram secret_token header'ı)
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const header = req.headers.get('x-telegram-bot-api-secret-token');
      if (header !== webhookSecret) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const update = await req.json().catch(() => null);
    if (!update) {
      return NextResponse.json({ ok: false, error: 'Invalid update' }, { status: 400 });
    }

    const msg = update?.message;
    if (!msg) return NextResponse.json({ ok: true });

    const chatId = String(msg.chat?.id);
    const text = String(msg.text || '');
    const username = msg.chat?.username || null;
    const firstName = msg.chat?.first_name || null;

    // /start <userId> — kullanıcı bağlantıyı başlatıyor
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const userId = parts[1];

      if (!userId) {
        // Bot'a /start atılmış ama userId yok — genel karşılama
        await sendRawMessage(chatId,
          `Merhaba${firstName ? ` ${firstName}` : ''}! 👋\n\n` +
          `*Otodedektif bildirim bot'una* hoş geldin.\n\n` +
          `Araç arama alarmlarını buradan almak için:\n` +
          `1. https://auto-dedective2.vercel.app adresine git\n` +
          `2. Giriş yap ve "Alarm Kur" butonuna tıkla\n` +
          `3. Telegram kanalını seç ve "Bağla" butonuna bas`
        );
        return NextResponse.json({ ok: true });
      }

      // userId geçerli mi?
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        await sendRawMessage(chatId, `❌ Geçersiz bağlantı. Lütfen Otodedektif üzerinden tekrar deneyin.`);
        return NextResponse.json({ ok: true });
      }

      // Kaydet (varsa güncelle)
      await db.telegramConnection.upsert({
        where: { userId: user.id },
        update: { chatId, username, firstName },
        create: {
          userId: user.id,
          chatId,
          username,
          firstName,
        },
      });

      await sendRawMessage(chatId,
        `✅ *Bağlantı başarılı!*\n\n` +
        `Merhaba${firstName ? ` ${firstName}` : ''}, Otodedektif hesabınla Telegram bildirimlerin artık aktif.\n\n` +
        `🔔 Seni hangi araç ilanları için haberdar edelim? Hemen bir alarm kur:\n` +
        `👉 https://auto-dedective2.vercel.app`
      );

      console.log(`[telegram] Connected user ${user.email} → chat ${chatId}`);
      return NextResponse.json({ ok: true });
    }

    // /help komutu
    if (text.startsWith('/help')) {
      await sendRawMessage(chatId,
        `🤖 *Otodedektif Bot Komutları*\n\n` +
        `/start - Botu başlat / bağlantı kur\n` +
        `/help - Bu yardım mesajı\n` +
        `/stop - Bildirimleri durdur\n\n` +
        `Web sitesi: https://auto-dedective2.vercel.app`
      );
      return NextResponse.json({ ok: true });
    }

    // /stop komutu
    if (text.startsWith('/stop')) {
      await db.telegramConnection.deleteMany({
        where: { chatId },
      }).catch(() => {});
      await sendRawMessage(chatId,
        `⛔ Bildirimler durduruldu. Tekrar bağlanmak için https://auto-dedective2.vercel.app adresinden "Telegram Bağla" butonuna tıkla.`
      );
      return NextResponse.json({ ok: true });
    }

    // Diğer mesajlar
    await sendRawMessage(chatId,
      `Merhaba! 👋 Komutları görmek için /help yaz.`
    );
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[API /telegram/webhook] Error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Failed' }, { status: 500 });
  }
}

// Webhook health check
export async function GET() {
  return NextResponse.json({
    ok: true,
    botConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
    botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
  });
}
