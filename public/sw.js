// Otodedektif Service Worker — Web Push bildirimleri
// Tarayıcı /sw.js olarak register eder.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push event — server'dan gelen push mesajını göster
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Otodedektif', body: event.data?.text() || 'Yeni bildirim' };
  }

  const title = data.title || '🚗 Otodedektif';
  const options = {
    body: data.body || 'Yeni ilan bildirimi',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/badge.png',
    tag: data.tag || 'otodedektif-alert',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/',
      ...(data.data || {}),
    },
    // Action butonları — kullanıcı direkt ilana gidebilir
    actions: [
      { action: 'open', title: '🔍 İncele' },
      { action: 'dismiss', title: '✕ Kapat' },
    ],
    // Vibrate pattern (mobile)
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click — URL'i aç
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Aynı URL'e açık bir tab varsa focusla
      for (const client of allClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }

      // Yoksa yeni tab aç
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// Subscription güncellendi — server'a yeni endpoint gönder
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const newSubscription = await self.registration.pushManager.subscribe(
        event.oldSubscription.options
      );
      // Server'a yeni subscription gönder
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: newSubscription }),
      });
    })()
  );
});

// Message from page — subscribe/unsubscribe komutları
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
