import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// Use env var or a fixed fallback (must be consistent across serverless invocations)
const SECRET = process.env.NEXTAUTH_SECRET || 'otodedektif-secret-key-2026-fixed-9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c'

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
          throw new Error('Email ve şifre gerekli')
        }

        let user: any = null
        try {
          user = await db.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
          })
        } catch (err) {
          console.error('[auth] DB error during login:', err)
          throw new Error('Giriş yapılamadı, tekrar deneyin')
        }

        if (!user) {
          throw new Error('Email veya şifre hatalı')
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          throw new Error('Email veya şifre hatalı')
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
    secret: SECRET,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        (session.user as any).role = token.role
      }
      return session
    },
  },

  pages: {
    signIn: '/auth/login',
  },

  // Suppress the "Server error" page in production
  debug: false,
}
