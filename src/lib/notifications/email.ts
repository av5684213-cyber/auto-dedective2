// Email gönderimi — Resend API
// RESEND_API_KEY yoksa veya gönderim başarısız olursa no-op (log atar, hata fırlatmaz).
// Alert sistemi blocking olmamalı — bir bildirim başarısız olursa diğerleri yine de gönderilmeli.

import { Resend } from 'resend'

let _client: Resend | null = null
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY)
  return _client
}

export interface AlertEmailData {
  to: string
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

export async function sendAlertEmail({ to, alertName, listing }: AlertEmailData): Promise<{ ok: boolean; error?: string }> {
  const client = getClient()
  if (!client) {
    console.log('[email] RESEND_API_KEY yok — email gönderimi atlandı:', to)
    return { ok: false, error: 'RESEND_API_KEY missing' }
  }

  const fromDomain = process.env.EMAIL_FROM_DOMAIN || 'otodedektif.com'
  const fromEmail = process.env.EMAIL_FROM || `bildirim@${fromDomain}`
  const appUrl = process.env.NEXTAUTH_URL || 'https://auto-dedective2.vercel.app'

  const priceFmt = new Intl.NumberFormat('tr-TR').format(listing.price)
  const kmFmt = listing.mileageKm ? new Intl.NumberFormat('tr-TR').format(listing.mileageKm) : null

  try {
    const { data, error } = await client.emails.send({
      from: `Otodedektif <${fromEmail}>`,
      to,
      subject: `🚗 "${alertName}" aramanız için yeni ilan!`,
      html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a">
  <div style="background:linear-gradient(135deg,#F15A24 0%,#ea580c 100%);padding:24px 28px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:28px">🚗</div>
      <div>
        <div style="color:white;font-weight:700;font-size:18px;line-height:1.2">Yeni İlan Bulundu</div>
        <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:2px">"${alertName}" kayıtlı aramanız</div>
      </div>
    </div>
  </div>

  <div style="padding:24px 28px">
    ${listing.imageUrl ? `<img src="${listing.imageUrl}" alt="${listing.make} ${listing.model}" style="width:100%;height:220px;object-fit:cover;border-radius:12px;margin-bottom:20px;background:#1a1a1a" onerror="this.style.display='none'"/>` : ''}

    <h2 style="color:white;margin:0 0 16px 0;font-size:22px;font-weight:700">${listing.make} ${listing.model}</h2>

    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr>
        <td style="color:#888;padding:8px 0;border-bottom:1px solid #1a1a1a;width:50%">📅 Yıl</td>
        <td style="color:white;padding:8px 0;border-bottom:1px solid #1a1a1a;font-weight:600">${listing.year}</td>
      </tr>
      ${kmFmt ? `<tr>
        <td style="color:#888;padding:8px 0;border-bottom:1px solid #1a1a1a">🛣️ KM</td>
        <td style="color:white;padding:8px 0;border-bottom:1px solid #1a1a1a;font-weight:600">${kmFmt} km</td>
      </tr>` : ''}
      ${listing.fuelType ? `<tr>
        <td style="color:#888;padding:8px 0;border-bottom:1px solid #1a1a1a">⛽ Yakıt</td>
        <td style="color:white;padding:8px 0;border-bottom:1px solid #1a1a1a;font-weight:600">${listing.fuelType}</td>
      </tr>` : ''}
      ${listing.transmission ? `<tr>
        <td style="color:#888;padding:8px 0;border-bottom:1px solid #1a1a1a">⚙️ Vites</td>
        <td style="color:white;padding:8px 0;border-bottom:1px solid #1a1a1a;font-weight:600">${listing.transmission}</td>
      </tr>` : ''}
      ${listing.city ? `<tr>
        <td style="color:#888;padding:8px 0;border-bottom:1px solid #1a1a1a">📍 Şehir</td>
        <td style="color:white;padding:8px 0;border-bottom:1px solid #1a1a1a;font-weight:600">${listing.city}</td>
      </tr>` : ''}
      <tr>
        <td style="color:#888;padding:12px 0">💰 Fiyat</td>
        <td style="color:#F15A24;font-size:22px;font-weight:700">${priceFmt} ₺</td>
      </tr>
    </table>

    ${listing.dealTag ? `<div style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.4);color:#4ade80;padding:10px 16px;border-radius:8px;margin-top:16px;font-size:14px;font-weight:600">✨ ${listing.dealTag}</div>` : ''}

    <a href="${listing.sourceUrl}" style="display:block;background:#F15A24;color:white;text-align:center;padding:14px 24px;border-radius:10px;margin-top:24px;text-decoration:none;font-weight:600;font-size:15px">
      İlanı İncele →
    </a>

    <div style="text-align:center;margin-top:20px">
      <a href="${appUrl}/alerts" style="color:#666;font-size:12px;text-decoration:none">Bildirim ayarlarını yönet</a>
    </div>
  </div>
</div>
`,
    })

    if (error) {
      console.error('[email] Resend error:', error.message)
      return { ok: false, error: error.message }
    }

    console.log(`[email] Sent to ${to} — id: ${data?.id}`)
    return { ok: true }
  } catch (e) {
    console.error('[email] Exception:', e instanceof Error ? e.message : e)
    return { ok: false, error: String(e) }
  }
}
