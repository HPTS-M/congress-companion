// CONGRESSAPP Service Worker — Web Push handlers
// Minimal SW: only push + notificationclick. No precaching to avoid PWA conflicts.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'CONGRESSAPP',
    body: '',
    url: '/',
    tag: 'announcement',
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (e) {
    // payload remains default
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: { url: payload.url },
      tag: payload.tag,
      renotify: true,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Reuse existing tab if it matches the target path
        for (const client of clientList) {
          try {
            const url = new URL(client.url);
            if (url.pathname.includes(targetUrl) && 'focus' in client) {
              return client.focus();
            }
          } catch (e) {
            // ignore invalid URL
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
