import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Admin Auth Middleware ──────────────────────────────────────────────
//
// Protects all /api/admin/* endpoints with a bearer token check.
// Accepts either:
//   1. ADMIN_TOKEN env var (manual admin calls)
//   2. CRON_SECRET env var (Vercel Cron jobs — see vercel.json)
//   3. x-admin-token header (alternative for cron jobs that don't set Bearer)
//
// If NEITHER env var is set, admin endpoints return 503 (fail-closed).

const ADMIN_PATH_PREFIX = '/api/admin';

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith(ADMIN_PATH_PREFIX)) {
    return NextResponse.next();
  }

  // Public admin read endpoints (safe — only aggregate stats from fallback data)
  // These are used by the dashboard UI which has no admin auth.
  const PUBLIC_READ_PATHS = ['/api/admin/stats', '/api/admin/adapters'];
  if (PUBLIC_READ_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  const acceptedTokens: string[] = [];
  if (process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.length >= 16) {
    acceptedTokens.push(process.env.ADMIN_TOKEN);
  }
  if (process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16) {
    acceptedTokens.push(process.env.CRON_SECRET);
  }

  if (acceptedTokens.length === 0) {
    return NextResponse.json(
      {
        error: 'Admin endpoints disabled',
        details:
          'ADMIN_TOKEN (and/or CRON_SECRET) env var is not configured. Set a strong token (>= 16 chars) to enable admin endpoints.',
      },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  let providedToken = bearerMatch?.[1]?.trim() ?? '';

  if (!providedToken) {
    providedToken = request.headers.get('x-admin-token')?.trim() ?? '';
  }

  if (!providedToken) {
    return NextResponse.json(
      { error: 'Unauthorized', details: 'Missing Authorization header. Expected: Bearer <token>' },
      { status: 401 },
    );
  }

  const authorized = acceptedTokens.some((t) => constantTimeCompare(t, providedToken));
  if (!authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', details: 'Invalid token' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
