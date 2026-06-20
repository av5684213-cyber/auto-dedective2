import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import { runDeduplication } from '@/lib/services/deduplicator';
import { cache } from '@/lib/services/cache';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDurationSeconds = 300;

/**
 * POST /api/admin/scrape-playwright
 *
 * Body (optional):
 *   site?: 'arabam' | 'vavacars' | 'sahibinden' | 'all'   (default: 'all')
 *   pages?: number                                          (default: 2)
 *   max?: number                                            (default: 200)
 *
 * Triggers the Playwright-based scraper for SPA/WAF-protected sites.
 * Does NOT touch Letgo data — Letgo runs through its own adapter.
 *
 * Letgo verisi bu endpoint'ten etkilenmez. Aynı DB'ye farklı sourceName
 * ile yeni kayıtlar eklenir (UPSERT anahtarı: sourceUrl).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const site: string = body.site || 'all';
  const pages: number = Number(body.pages) || 2;
  const max: number = Number(body.max) || 200;

  const scriptPath = path.join(process.cwd(), 'scripts', 'playwright-scrape.ts');
  const args = ['run', scriptPath, `--site=${site}`, `--pages=${pages}`, `--max=${max}`];

  // Snapshot DB counts before so we can compare after (Letgo data preserved)
  const before = await db.listing.groupBy({
    by: ['sourceName'],
    where: { isActive: true },
    _count: true,
  });
  const beforeMap = new Map(before.map((r) => [r.sourceName, r._count]));

  // Spawn bun process so a crash doesn't take down the Next.js server
  const result = await new Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null }>(
    (resolve) => {
      const proc = spawn('bun', args, {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => resolve({ ok: code === 0, stdout, stderr, code }));
      proc.on('error', (err) => resolve({ ok: false, stdout, stderr: err.message, code: -1 }));
    },
  );

  // Re-run valuation & cost estimation (works for ALL listings — including Letgo, which stays as-is)
  try {
    await valueAllListings();
  } catch (e) {
    console.error('[scrape-playwright] valuation error:', e);
  }
  try {
    await estimateAllCosts();
  } catch (e) {
    console.error('[scrape-playwright] cost est error:', e);
  }
  try {
    await runDeduplication();
  } catch (e) {
    console.error('[scrape-playwright] dedup error:', e);
  }
  await cache.clear();

  // Snapshot DB counts after
  const after = await db.listing.groupBy({
    by: ['sourceName'],
    where: { isActive: true },
    _count: true,
  });
  const afterMap = new Map(after.map((r) => [r.sourceName, r._count]));

  // Build delta report
  const allSources = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);
  const delta: { source: string; before: number; after: number; change: number }[] = [];
  for (const s of allSources) {
    const b = beforeMap.get(s) ?? 0;
    const a = afterMap.get(s) ?? 0;
    delta.push({ source: s, before: b, after: a, change: a - b });
  }

  return NextResponse.json({
    success: result.ok,
    exitCode: result.code,
    stdout: result.stdout.split('\n').slice(-50).join('\n'),
    stderr: result.stderr.split('\n').slice(-20).join('\n'),
    deltaBySource: delta,
    letgoUntouched: (beforeMap.get('letgo') ?? 0) === (afterMap.get('letgo') ?? 0),
  });
}

/** GET returns last scrape log entries + adapter availability */
export async function GET() {
  const logs = await db.scrapeLog.findMany({
    orderBy: { endTime: 'desc' },
    take: 10,
    select: {
      sourceName: true,
      status: true,
      itemsFound: true,
      itemsSaved: true,
      endTime: true,
      durationMs: true,
      errorMsg: true,
    },
  });

  const bySource = await db.listing.groupBy({
    by: ['sourceName'],
    where: { isActive: true },
    _count: true,
  });

  return NextResponse.json({
    sources: bySource.map((s) => ({ sourceName: s.sourceName, count: s._count })),
    recentLogs: logs,
    playwrightTargets: [
      { site: 'arabam', url: 'https://www.arabam.com', note: 'Cloudflare korumalı' },
      { site: 'vavacars', url: 'https://www.vavacars.com.tr', note: 'DNS çözümlenemiyor (TR dışı erişim)' },
      { site: 'sahibinden', url: 'https://www.sahibinden.com', note: 'Cloudflare korumalı' },
    ],
    letgoNote:
      "Letgo verisi bu endpoint'ten etkilenmez. Kendi adapter'ı üzerinden ayrı çalışır.",
  });
}
