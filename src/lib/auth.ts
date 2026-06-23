// Otodedektif - NextAuth Configuration
//
// Credentials-based auth (email + password).
// JWT session (serverless-friendly, no DB session needed).
// bcryptjs for password hashing.

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || randomBytes(32).toString('hex')

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

        // Find user by email
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

        // Verify password
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
    secret: NEXTAUTH_SECRET,
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
}
