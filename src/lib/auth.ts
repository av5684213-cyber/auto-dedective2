import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

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
        console.log('[auth] authorize called, email:', credentials?.email)
        
        if (!credentials?.email || !credentials?.password) {
          console.log('[auth] Missing credentials')
          return null
        }

        let user: any = null
        try {
          user = await db.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
          })
          console.log('[auth] User found:', user ? user.email : 'not found')
        } catch (err) {
          console.error('[auth] DB error:', err)
          return null
        }

        if (!user) return null

        try {
          const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
          console.log('[auth] Password valid:', isValid)
          if (!isValid) return null
        } catch (err) {
          console.error('[auth] bcrypt error:', err)
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

  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  jwt: { secret: SECRET },

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: { sameSite: 'lax', path: '/', secure: true },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
    },
    pkceCodeVerifier: {
      name: `next-auth.pkce.code-verifier`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = (user as any).id; token.role = (user as any).role }
      return token
    },
    async session({ session, token }) {
      if (session.user) { (session.user as any).id = token.id; (session.user as any).role = token.role }
      return session
    },
  },

  pages: { signIn: '/auth/login' },
}
