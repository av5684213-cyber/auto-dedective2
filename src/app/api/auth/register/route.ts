import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { z } from 'zod'

// ── POST /api/auth/register ────────────────────────────────────────────
//
// Body:
//   { "email": "user@example.com", "password": "secret", "name": "Onur" }

const registerSchema = z.object({
  email: z.string().email('Geçerli bir email girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
  name: z.string().min(2, 'İsim en az 2 karakter olmalı').optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const parseResult = registerSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Geçersiz giriş' },
        { status: 400 },
      )
    }

    const { email, password, name } = parseResult.data
    const emailLower = email.toLowerCase().trim()

    const existing = await db.user.findUnique({ where: { email: emailLower } })
    if (existing) {
      return NextResponse.json({ error: 'Bu email zaten kayıtlı' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await db.user.create({
      data: { email: emailLower, passwordHash, name: name || null },
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (error) {
    console.error('[API /auth/register] Error:', error)
    return NextResponse.json({ error: 'Kayıt başarısız' }, { status: 500 })
  }
}
