// Telegram Bot mesaj gönderimi
// TELEGRAM_BOT_TOKEN yoksa no-op.

export interface AlertTelegramData {
  chatId: string
  alertName: string
  listing: {
    id: string
    make: string
    model: string
    year: number
    price: number
    mileageKm?: number | null
    city?: string | null
    fuelType?: string | null
    transmission?: string | null
    imageUrl?: string | null
    sourceUrl: string
    dealTag?: string | null
  }
}

export async function sendAlertTelegram({ chatId, alertName, listing }: AlertTelegramData): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN yok — atlandı')
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN missing' }
  }

  const priceFmt = new Intl.NumberFormat('tr-TR').format(listing.price)
  const kmFmt = listing.mileageKm ? new Intl.NumberFormat('tr-TR').format(listing.mileageKm) : null

  // MarkdownV2 escape - Telegram MarkdownV2 mode敏感
  const esc = (s: string | number | null | undefined) =>
    String(s ?? '').replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1')

  const text = [
    `🚗 *${esc(`${listing.make} ${listing.model}`)}*`,
    `📋 Kayıtlı arama: _${esc(alertName)}_`,
    ``,
    `📅 Yıl: ${esc(listing.year)}`,
    kmFmt ? `🛣️ KM: ${esc(kmFmt)} km` : null,
    listing.fuelType ? `⛽ Yakıt: ${esc(listing.fuelType)}` : null,
    listing.transmission ? `⚙️ Vites: ${esc(listing.transmission)}` : null,
    listing.city ? `📍 Şehir: ${esc(listing.city)}` : null,
    `💰 Fiyat: *${esc(priceFmt)} ₺*`,
    listing.dealTag ? `✨ ${esc(listing.dealTag)}` : null,
  ].filter(Boolean).join('\n')

  // Önce fotoğraf gönder (varsa), sonra mesaj
  try {
    if (listing.imageUrl) {
      try {
        const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: listing.imageUrl,
            caption: text,
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔍 İlanı İncele', url: listing.sourceUrl }
              ]]
            }
          }),
        })
        const photoData = await photoRes.json()
        if (photoData.ok) return { ok: true }
        // fotoğraf başarısız olursa mesaj ile devam et
        console.warn('[telegram] Photo failed, falling back to text:', photoData.description)
      } catch (e) {
        console.warn('[telegram] Photo exception, falling back:', e instanceof Error ? e.message : e)
      }
    }

    // Sadece mesaj gönder
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: [[
            { text: '🔍 İlanı İncele', url: listing.sourceUrl }
          ]]
        }
      }),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('[telegram] API error:', data.description)
      return { ok: false, error: data.description }
    }
    return { ok: true }
  } catch (e) {
    console.error('[telegram] Exception:', e instanceof Error ? e.message : e)
    return { ok: false, error: String(e) }
  }
}

/**
 * Telegram bot webhook /start komutunu işler.
 * Gelen mesajdaki /start <userId> parse edilir, user'ın chat_id'si kaydedilir.
 */
export async function handleTelegramUpdate(update: any): Promise<{ ok: boolean }> {
  const msg = update?.message
  if (!msg) return { ok: true }

  const chatId = String(msg.chat?.id)
  const text = String(msg.text || '')
  const username = msg.chat?.username
  const firstName = msg.chat?.first_name

  // /start <userId> komutu beklenir
  // Kullanıcı UI'da /api/telegram/connect çağırır → orada bot'tan /start <userId> komutu istenir
  if (text.startsWith('/start')) {
    const parts = text.split(' ')
    const userId = parts[1]

    if (!userId) {
      // Bot'a /start atılmış ama userId yok — genel karşılama
      await sendRawMessage(chatId,
        `Merhaba${firstName ? ` ${firstName}` : ''}! 👋\n\n` +
        `Otodedektif bildirim bot'una hoş geldin.\n\n` +
        `Araç arama alarm'larını buradan almak için:\n` +
        `1. https://auto-dedective2.vercel.app adresine git\n` +
        `2. Giriş yap ve "Alarm Kur" butonuna tıkla\n` +
        `3. Telegram kanalını seç ve bağlantı talimatını izle`
      )
      return { ok: true }
    }

    // userId geçerli mi kontrol et — bu fonksiyon dışarıdan bir prisma bağlamı bekler
    // Webhook route'ta kayıt yapılır
    return { ok: true }
  }

  return { ok: true }
}

export async function sendRawMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    })
  } catch {
    // ignore
  }
}
