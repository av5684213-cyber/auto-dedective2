'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Car, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

function LoginForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // redirect: true → NextAuth callback URL'e yönlendirir, session cookie set edilir
      // Hata durumunda NextAuth ?error=credentials girer ama bizim authorize null döndüğü için
      // callback URL'e gider. Bu yüzden önce manuel kontrol yapıp doğru credentialar ile
      // redirect: true çağırıyoruz.
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Email veya şifre hatalı')
        setLoading(false)
      } else if (result?.ok) {
        // Başarılı — callback URL'e yönlendir
        // callbackUrl absolute URL olabilir (localhost'a yönlendirmeyi önlemek için
        // sadece path kısmını kullan)
        const safeUrl = callbackUrl.startsWith('http')
          ? new URL(callbackUrl).pathname
          : callbackUrl
        window.location.href = safeUrl || '/'
      }
    } catch (err) {
      setError('Giriş yapılamadı, tekrar deneyin')
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md"
    >
      <div className="flex items-center justify-center gap-2 mb-8">
        <Car className="h-8 w-8 text-orange-600" />
        <span className="text-2xl font-extrabold">
          <span className="text-orange-600">Oto</span>
          <span className="text-amber-500">dedektif</span>
        </span>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Giriş Yap</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 gap-1.5"
              disabled={loading}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Hesabın yok mu?{' '}
            <Link href="/auth/register" className="text-orange-600 hover:text-orange-700 font-medium">
              Kayıt ol
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Ana sayfaya dön
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-card to-background p-4">
      <Suspense fallback={<div className="text-muted-foreground">Yükleniyor...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
