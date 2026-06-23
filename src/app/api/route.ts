import { NextResponse } from "next/server";

// Health check endpoint — reports build version + env status.
export async function GET() {
  return NextResponse.json({
    message: "Otodedektif API",
    version: "2026-06-23-v1",
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV ?? 'unknown',
      hasAdminToken: !!process.env.ADMIN_TOKEN,
      hasCronSecret: !!process.env.CRON_SECRET,
      hasRedisUrl: !!process.env.REDIS_URL,
      databaseUrlPrefix: (process.env.DATABASE_URL || '').split(':')[0],
    },
  });
}
