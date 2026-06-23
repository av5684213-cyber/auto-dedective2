'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function UserMenu() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Loading state
  if (status === 'loading') {
    return <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
  }

  // Not logged in
  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/auth/login')}
          className="text-xs sm:text-sm"
        >
          Giriş Yap
        </Button>
        <Button
          size="sm"
          onClick={() => router.push('/auth/register')}
          className="bg-teal-600 hover:bg-teal-700 text-xs sm:text-sm"
        >
          Kayıt Ol
        </Button>
      </div>
    )
  }

  const userName = (session.user as any).name || (session.user as any).email?.split('@')[0] || 'User'
  const initials = userName.charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 p-1 rounded-full hover:bg-muted transition-colors"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-teal-600 text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-popover shadow-lg z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); router.push('/auth/profile') }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <User className="h-4 w-4" />
              Profilim
            </button>

            <button
              onClick={() => { setOpen(false); router.push('/?tab=favorites') }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4" />
              Favorilerim
            </button>
          </div>

          <div className="border-t py-1">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
