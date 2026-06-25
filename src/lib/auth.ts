// Otodedektif - NextAuth Configuration
//
// Credentials-based auth (email + password).
// JWT session (serverless-friendly, no DB session needed).
// bcryptjs for password hashing.
// SQLite DB (Prisma) — kullanıcılar ve favoriler DB'de saklanır.

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'otodedektif-dev-secret-stable-do-not-change-2026'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })

        if (!user) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          role: user.role,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  jwt: {
    secret: NEXTAUTH_SECRET,
  },

  pages: {
    signIn: '/auth/login',
  },
}
