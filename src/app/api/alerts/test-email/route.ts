import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendAlertEmail } from '@/lib/notifications/email';

// ── POST /api/alerts/test-email ──────────────────────────────────────────
//
// Kullanıcıya test emaili gönderir. RESEND_API_KEY yoksa no-op döner.
// Auth gerekir — sadece kendi emailine test gönderebilir.

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    // Test listing bilgisi
    const testListing = {
      id: 'test-email-' + Date.now(),
      make: 'Test',
      model: 'Araç',
      year: 2024,
      price: 999999,
      mileageKm: 50000,
      city: 'İstanbul',
      fuelType: 'Benzin',
      transmission: 'Otomatik',
      imageUrl: null,
      sourceUrl: process.env.NEXTAUTH_URL || 'https://auto-dedective2.vercel.app',
      dealTag: 'Harika Fırsat',
    };

    const r = await sendAlertEmail({
      to: session.user.email,
      alertName: 'Test Bildirimi',
      listing: testListing,
    });

    return NextResponse.json({
      ok: r.ok,
      error: r.error,
      to: session.user.email,
      resendConfigured: !!process.env.RESEND_API_KEY,
      emailFrom: process.env.EMAIL_FROM || '(default: bildirim@otodedektif.com)',
    });
  } catch (error: any) {
    console.error('[API /alerts/test-email] Error:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Failed' }, { status: 500 });
  }
}
