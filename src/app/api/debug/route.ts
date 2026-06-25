import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const expected = process.env.ADMIN_TOKEN || process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL || "";
  const directUrl = process.env.DIRECT_URL || "";
  const maskUrl = (u: string) => u.replace(/:[^:@]+@/, ":***@");

  let liveCount = -1;
  let dbError: string | null = null;
  try {
    liveCount = await db.listing.count({ where: { isActive: true } });
  } catch (e) {
    dbError = (e as Error).message;
  }

  return NextResponse.json({
    env: {
      databaseUrl: maskUrl(dbUrl),
      directUrl: maskUrl(directUrl),
      hasAdminToken: !!process.env.ADMIN_TOKEN,
      hasCronSecret: !!process.env.CRON_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
    },
    db: { liveCount, error: dbError },
  });
}
