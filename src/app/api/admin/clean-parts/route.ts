import { NextRequest, NextResponse } from 'next/server';
import { runPartsCleaningBot } from '@/lib/services/parts-filter';

// ── POST /api/admin/clean-parts ──────────────────────────────────────────
//
// Parça tespit ve temizlik bot'unu manuel tetikler.
// DB'deki tüm aktif ilanları tarar, parça/yedek parça olanları pasife alır.
//
// Auth: ADMIN_TOKEN veya CRON_SECRET ile Bearer header.
// Vercel cron tarafından da çağrılabilir (x-vercel-cron header).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const cronHeader = req.headers.get('x-vercel-cron');

  const validSecrets = [
    process.env.ADMIN_TOKEN,
    process.env.CRON_SECRET,
  ].filter(Boolean);

  const isAuthorized =
    (cronHeader === '1') ||
    (auth && validSecrets.some(s => auth === `Bearer ${s}`));

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[API /admin/clean-parts] Bot başlatılıyor...');
    const result = await runPartsCleaningBot();

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /admin/clean-parts] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Bot çalıştırılamadı' },
      { status: 500 }
    );
  }
}

// GET — cron tarafından çağrılabilir
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const cronHeader = req.headers.get('x-vercel-cron');

  const validSecrets = [
    process.env.ADMIN_TOKEN,
    process.env.CRON_SECRET,
  ].filter(Boolean);

  const isAuthorized =
    (cronHeader === '1') ||
    (auth && validSecrets.some(s => auth === `Bearer ${s}`));

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPartsCleaningBot();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message },
      { status: 500 }
    );
  }
}
