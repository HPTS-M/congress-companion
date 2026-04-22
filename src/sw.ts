/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
// CONGRESSAPP Service Worker — Workbox precache + runtime cache + Web Push.
// Built via vite-plugin-pwa "injectManifest" mode.

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─── Lifecycle ───────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Precache (App Shell) ────────────────────────────────────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback — serve cached index.html for any client navigation
// EXCEPT admin routes, oauth callbacks, supabase edge functions, and assets.
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [
    /^\/~oauth/,
    /\/admin(\/|$)/,
    /\/functions\/v1\//,
    /\/storage\/v1\//,
    /\/rest\/v1\//,
    /\.[^/]+$/, // any path with a file extension
  ],
});
registerRoute(navigationRoute);

// ─── Runtime caching ─────────────────────────────────────────────────────────

// 1. Supabase REST — attendees: NetworkFirst (fresh), 24h fallback
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/rest/v1/') &&
    url.pathname.includes('attendees'),
  new NetworkFirst({
    cacheName: 'supabase-attendees-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// 2. Supabase REST — read-mostly event content: StaleWhileRevalidate, 24h
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/rest/v1/') &&
    /event_activities|sponsors|documents|attendee_services|service_catalog|service_tickets|events/.test(
      url.pathname,
    ),
  new StaleWhileRevalidate({
    cacheName: 'supabase-data-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// 3. Supabase REST — announcements: NetworkFirst, 2h
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') && url.pathname.includes('announcements'),
  new NetworkFirst({
    cacheName: 'announcements-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 2 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// 4. Public storage assets (sponsor logos, speaker photos, banners): CacheFirst 7d.
//    EXPLICITLY EXCLUDES /storage/v1/object/sign/ (signed URLs expire in 1h).
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/storage/v1/object/public/'),
  new CacheFirst({
    cacheName: 'public-assets-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// 5. Signed storage URLs — NEVER cache (would break after 1h expiry)
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/storage/v1/object/sign/'),
  new NetworkOnly(),
);

// 6. Edge functions and realtime — always network
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') &&
    (url.pathname.includes('/functions/v1/') || url.pathname.includes('/realtime/')),
  new NetworkOnly(),
);

// 7. Generic images (excluding venue map, which the page handles itself)
registerRoute(
  ({ url }) =>
    /\.(?:png|jpg|jpeg|svg|gif|webp)$/.test(url.pathname) &&
    !url.pathname.includes('venue-map'),
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// ─── Web Push (migrated from public/sw.js) ───────────────────────────────────
self.addEventListener('push', (event) => {
  let payload: { title: string; body: string; url: string; tag: string } = {
    title: 'CONGRESSAPP',
    body: '',
    url: '/',
    tag: 'announcement',
  };

  try {
    if (event.data) {
      payload = { ...payload, ...(event.data.json() as Partial<typeof payload>) };
    }
  } catch {
    // keep defaults
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: { url: payload.url },
      tag: payload.tag,
      // Non-standard but widely supported on Chromium/Android.
      ...({ renotify: true, vibrate: [200, 100, 200] } as Record<string, unknown>),
    } as NotificationOptions),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as any)?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          try {
            const url = new URL(client.url);
            if (url.pathname.includes(targetUrl) && 'focus' in client) {
              return client.focus();
            }
          } catch {
            // ignore
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
