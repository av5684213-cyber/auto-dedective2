// ── Admin authorization helper ───────────────────────────────────────────
//
// Tüm /admin route'ları (page ve API) bu helper'ı kullanır.
// Sadece User.role === 'admin' | 'staff' olan kullanıcılar erişebilir.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export interface AdminUser {
  id: string
  email: string
  name?: string | null
  role: string
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) return null

  if (user.role !== 'admin' && user.role !== 'staff') return null
  return user
}

// API route'ları için kullanım:
//   const user = await getAdminUser()
//   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   // ... işlemler
//
// Page (server component)'lerde kullanım:
//   const user = await getAdminUser()
//   if (!user) redirect('/auth/login?callbackUrl=/admin/...')
