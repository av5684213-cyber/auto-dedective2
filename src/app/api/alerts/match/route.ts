import { NextRequest, NextResponse } from 'next/server';
import { runAlertMatching } from '@/lib/notifications/matcher';

// ── POST /api/alerts/match ──────────────────────────────────────────────
//
// Scraper her yeni ilan batch'inde bu endpoint'i çağırır.
// Aktif alert'lere karşı eşleştirme yapar, uygun kanallara paralel bildirim gönderir.
//
// Auth: x-scraper-secret header'ı SCRAPER_SECRET (veya ADMIN_TOKEN) ile eşleşmeli.
// Vercel cron direkt bu route'u çağırabilir (CRON_SECRET ile).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ScraperListing {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileageKm?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  bodyType?: string | null;
  city?: string | null;
  sellerType?: string | null;
  dealTag?: string | null;
  imageUrl?: string | null;
  sourceUrl: string;
  firstSeenAt?: string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const scraperSecret = req.headers.get('x-scraper-secret');
  const cronHeader = req.headers.get('x-vercel-cron');

  const validSecrets = [
    process.env.SCRAPER_SECRET,
    process.env.ADMIN_TOKEN,
    process.env.CRON_SECRET,
  ].filter(Boolean);

  const isAuthorized =
    (cronHeader === '1' && validSecrets.includes(process.env.CRON_SECRET || '')) ||
    (scraperSecret && validSecrets.includes(scraperSecret)) ||
    (authHeader && validSecrets.some(s => authHeader === `Bearer ${s}`));

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const listings: ScraperListing[] = Array.isArray(body?.listings) ? body.listings : [];
    const dryRun = body?.dryRun === true;

    if (!listings.length) {
      return NextResponse.json({ error: 'listings array boş' }, { status: 400 });
    }

    const result = await runAlertMatching(listings, { dryRun });

    return NextResponse.json({
      ok: true,
      dryRun,
      ...result,
    });
  } catch (error: any) {
    console.error('[API /alerts/match] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Match failed' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');

  const validSecrets = [
    process.env.CRON_SECRET,
    process.env.ADMIN_TOKEN,
  ].filter(Boolean);

  const isAuthorized =
    (cronHeader === '1') ||
    (authHeader && validSecrets.some(s => authHeader === `Bearer ${s}`));

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { runCronAlertMatching } = await import('@/lib/notifications/matcher');
    const result = await runCronAlertMatching({ sinceHours: 24 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[API /alerts/match GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Cron match failed' },
      { status: 500 },
    );
  }
}
