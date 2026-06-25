import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
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
    await db.$disconnect()
  })
}
