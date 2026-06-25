import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email('Geçerli bir email girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
  name: z.string().min(2, 'İsim en az 2 karakter olmalı').optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    console.log('[register] Body:', JSON.stringify(body))
    
    const parseResult = registerSchema.safeParse(body)
    if (!parseResult.success) {
      console.log('[register] Validation failed:', parseResult.error.issues[0]?.message)
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Geçersiz giriş' },
        { status: 400 },
      )
    }

    const { email, password, name } = parseResult.data
    const emailLower = email.toLowerCase().trim()
    console.log('[register] Email:', emailLower)

    // Check existing
    let existing: any = null
    try {
      existing = await db.user.findUnique({ where: { email: emailLower } })
      console.log('[register] Existing user:', existing ? 'found' : 'not found')
    } catch (err) {
      console.error('[register] DB findUnique error:', err)
      return NextResponse.json({ error: 'DB erişim hatası: ' + (err as Error).message }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ error: 'Bu email zaten kayıtlı' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    console.log('[register] Password hashed')

    let user: any
    try {
      user = await db.user.create({
        data: { email: emailLower, passwordHash, name: name || null },
      })
      console.log('[register] User created:', user.id)
    } catch (err) {
      console.error('[register] DB create error:', err)
      return NextResponse.json({ error: 'DB kayıt hatası: ' + (err as Error).message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (error) {
    console.error('[register] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Kayıt başarısız: ' + (error as Error).message },
      { status: 500 },
    )
  }
}
