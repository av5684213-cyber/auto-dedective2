import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Supabase pooler URL'yi güvenli hale getir:
 * - Eğer URL session mode (port 5432) ise → transaction mode (6543) çevir
 * - Eğer URL'de pgbouncer=true yoksa → ekle (PgBouncer transaction mode'da prepared statements kapalı olmalı)
 * - connection_limit=1 ekle (her lambda en fazla 1 bağlantı alır, pool tüketmez)
 *
 * Bu fallback sayesinde Vercel env hatalı olsa bile doğru pooler'a gider.
 */
function normalizeDbUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return ''
  let url = rawUrl.trim()

  // Session mode (5432) → Transaction mode (6543)
  // Supabase pooler hostname'i .pooler.supabase.com içeriyorsa 6543 transaction pooler'dır
  if (url.includes('.pooler.supabase.com')) {
    url = url.replace(/:5432\//, ':6543/')
  }

  // pgbouncer=true parametresi yoksa ekle
  if (!url.includes('pgbouncer=')) {
    url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true'
  }

  // connection_limit yoksa 1 yap (lambda başına 1 bağlantı)
  if (!url.includes('connection_limit=')) {
    url += (url.includes('?') ? '&' : '&') + 'connection_limit=1'
  }

  // pool_timeout yoksa 60s (varsayılan 10s kısa)
  if (!url.includes('pool_timeout=')) {
    url += '&pool_timeout=60'
  }

  return url
}

function createPrismaClient(): PrismaClient {
  const url = normalizeDbUrl(process.env.DATABASE_URL || process.env.DIRECT_URL)
  if (!url) {
    console.error('[db] FATAL: DATABASE_URL ve DIRECT_URL ikisi de boş!')
  } else {
    // Hassas bilgi loglamadan maskele
    const masked = url.replace(/:[^:@]+@/, ':***@')
    console.log(`[db] Prisma connecting to: ${masked}`)
  }

  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: { url },
    },
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}

// Vercel serverless'ta bağlantıyı kapat — pool dolmasın
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    try {
      await db.$disconnect()
    } catch {
      // ignore
    }
  })
}
