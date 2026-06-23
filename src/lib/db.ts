import { PrismaClient } from '@prisma/client'

// ── Prisma Singleton (production-safe) ──────────────────────────────────
//
// Single client per process via globalThis, used in ALL environments.
// Prisma-recommended pattern for Next.js to avoid connection storms on
// serverless cold starts (Vercel).
//
// Ref: https://www.prisma.io/docs/guides/nextjs

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: ['error', 'warn'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}
