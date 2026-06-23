import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import { runDeduplication } from '@/lib/services/deduplicator';
import { cache } from '@/lib/services/cache';
import { db } from '@/lib/db';
import {
  scrapePlaywrightBodySchema,
  SCRAPE_PLAYWRIGHT_SITES,
} from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';
export const maxDurationSeconds = 300;

// ── POST Handler ───────────────────────────────────────────────────────
//
// STRICT Zod validation — invalid input returns 400 (not silently defaulted)
// because params are passed to spawn().

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parseResult = scrapePlaywrightBodySchema.safeParse(rawBody);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { site, pages, max } = parseResult.data;

  if (!SCRAPE_PLAYWRIGHT_SITES.includes(site)) {
    return NextResponse.json({ error: 'Invalid site parameter' }, { status: 400 });
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'playwright-scrape.ts');
  const args = ['run', scriptPath, `--site=${site}`, `--pages=${pages}`, `--max=${max}`];

  const before = await db.listing.groupBy({
    by: ['sourceName'], where: { isActive: true }, _count: true,
  });
  const beforeMap = new Map(before.map((r) => [r.sourceName, r._count]));

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

  try { await valueAllListings(); } catch (e) { /* ignore */ }
  try { await estimateAllCosts(); } catch (e) { /* ignore */ }
  try { await runDeduplication(); } catch (e) { /* ignore */ }
  try { await cache.clear(); } catch (e) { /* ignore */ }

  const after = await db.listing.groupBy({
    by: ['sourceName'], where: { isActive: true }, _count: true,
  });
  const afterMap = new Map(after.map((r) => [r.sourceName, r._count]));

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

export async function GET() {
  let logs: any[] = [];
  let bySource: any[] = [];
  try {
    logs = await db.scrapeLog.findMany({
      orderBy: { endTime: 'desc' }, take: 10,
      select: { sourceName: true, status: true, itemsFound: true, itemsSaved: true, endTime: true, durationMs: true, errorMsg: true },
    });
    bySource = await db.listing.groupBy({ by: ['sourceName'], where: { isActive: true }, _count: true });
  } catch (e) { /* ignore */ }

  return NextResponse.json({
    sources: bySource.map((s) => ({ sourceName: s.sourceName, count: s._count })),
    recentLogs: logs,
    playwrightTargets: [
      { site: 'arabam', url: 'https://www.arabam.com', note: 'Cloudflare korumalı' },
      { site: 'vavacars', url: 'https://www.vavacars.com.tr', note: 'DNS çözümlenemiyor (TR dışı erişim)' },
      { site: 'sahibinden', url: 'https://www.sahibinden.com', note: 'Cloudflare korumalı' },
    ],
  });
}
