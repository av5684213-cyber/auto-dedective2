// Client-side push subscription helper
// Tarayıcıda Notification permission + service worker + push subscription yönetir.

'use client';

const SW_PATH = '/sw.js';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined' ? window.atob(base64) : '';
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error('[push] SW register failed:', e);
    return null;
  }
}

export async function getPushPermissionState(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export async function subscribeToPush(): Promise<{ ok: boolean; subscription?: PushSubscription; error?: string }> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { ok: false, error: 'VAPID public key tanımlı değil (env eksik)' };
  }

  const permission = await getPushPermissionState();
  if (permission !== 'granted') {
    return { ok: false, error: `Bildirim izni verilmedi (mevcut: ${permission})` };
  }

  const reg = await registerServiceWorker();
  if (!reg) {
    return { ok: false, error: 'Service worker kurulamadı' };
  }

  try {
    // Mevcut subscription var mı?
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Server'a gönder
    const p256dhBuf = subscription.getKey('p256dh')
    const authBuf = subscription.getKey('auth')
    if (!p256dhBuf || !authBuf) {
      return { ok: false, error: 'Push keys alınamadı' }
    }
    const p256dh = btoa(String.fromCharCode(...Array.from(new Uint8Array(p256dhBuf))))
    const auth = btoa(String.fromCharCode(...Array.from(new Uint8Array(authBuf))))

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || 'Server kaydı başarısız' };
    }

    return { ok: true, subscription };
  } catch (e: any) {
    console.error('[push] Subscribe failed:', e);
    return { ok: false, error: e?.message || 'Subscription başarısız' };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    await fetch('/api/push/subscribe', { method: 'DELETE' });
    return { ok: true };
  } catch (e) {
    console.error('[push] Unsubscribe failed:', e);
    return { ok: false };
  }
}
