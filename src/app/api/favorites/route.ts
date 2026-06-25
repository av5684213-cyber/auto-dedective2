import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { transformListing } from '@/lib/utils/transform-listing'
import { loadFallbackListings } from '@/lib/services/fallback-data'
import { authOptions } from '@/lib/auth'

// ── GET /api/favorites ─────────────────────────────────────────────────
//
// Giriş yapmış kullanıcının favori ilanlarını döndürür.
// Auth: zorunlu (session gerekli)

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        favorites: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ favorites: [], listings: [] })
    }

    const favoriteIds = user.favorites.map((f) => f.listingId)

    if (favoriteIds.length === 0) {
      return NextResponse.json({ favorites: [], listings: [] })
    }

    // Listing'leri DB + fallback'ten topla
    let dbListings: any[] = []
    try {
      dbListings = await db.listing.findMany({
        where: { id: { in: favoriteIds } },
      })
    } catch (err) {
      // DB'de listing tablosu boş olabilir — fallback kullan
    }

    const foundMap = new Map<string, any>()
    for (const listing of dbListings) {
      foundMap.set(listing.id, listing)
    }

    const fallbackListings = loadFallbackListings()
    const missingIds = favoriteIds.filter((id) => !foundMap.has(id))
    for (const id of missingIds) {
      const fallback = fallbackListings.find((l) => l.id === id)
      if (fallback) foundMap.set(id, fallback)
    }

    const listings = favoriteIds
      .map((id) => foundMap.get(id))
      .filter((l) => l !== undefined)
      .map((l) => transformListing(l as unknown as Record<string, unknown>))

    return NextResponse.json({
      favorites: favoriteIds,
      listings,
    })
  } catch (error) {
    console.error('[API /favorites GET] Error:', error)
    return NextResponse.json({ error: 'Favoriler yüklenemedi' }, { status: 500 })
  }
}

// ── POST /api/favorites ────────────────────────────────────────────────
//
// Body:
//   { "listingId": "id" }       — favorilere ekle
//   { "listingId": "id", "action": "remove" }  — favorilerden çıkar
//
// Auth: zorunlu

const bodySchema = {
  parse(body: any): { listingId: string; action?: 'add' | 'remove' } | null {
    if (!body || typeof body !== 'object') return null
    if (typeof body.listingId !== 'string' || !body.listingId) return null
    return { listingId: body.listingId, action: body.action === 'remove' ? 'remove' : 'add' }
  },
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.parse(body)
    if (!parsed) {
      return NextResponse.json({ error: 'listingId gerekli' }, { status: 400 })
    }

    const { listingId, action } = parsed

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    if (action === 'remove') {
      try {
        await db.userFavorite.deleteMany({
          where: { userId: user.id, listingId },
        })
      } catch (err) {
        // Listing DB'de yoksa foreign key hatası olabilir — favori zaten yok
      }
      return NextResponse.json({ success: true, action: 'removed' })
    }

    // Add
    try {
      await db.userFavorite.create({
        data: { userId: user.id, listingId },
      })
    } catch (err: any) {
      // Zaten favorilerde (unique constraint) veya listing yok — sessizce yoksay
      if (err?.code === 'P2002') {
        return NextResponse.json({ success: true, action: 'already-favorite' })
      }
    }
    return NextResponse.json({ success: true, action: 'added' })
  } catch (error) {
    console.error('[API /favorites POST] Error:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// ── DELETE /api/favorites?listingId=xxx ────────────────────────────────
//
// Favorilerden çıkar (alternatif endpoint)

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const listingId = searchParams.get('listingId')
    if (!listingId) {
      return NextResponse.json({ error: 'listingId parametresi gerekli' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    try {
      await db.userFavorite.deleteMany({
        where: { userId: user.id, listingId },
      })
    } catch (err) {
      // Listing yok olabilir — sessizce yoksay
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API /favorites DELETE] Error:', error)
    return NextResponse.json({ error: 'Silme başarısız' }, { status: 500 })
  }
}
