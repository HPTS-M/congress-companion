import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { initSentry } from '@/lib/sentry';
import { initWebVitals } from '@/lib/perf';
import { ErrorFallback } from '@/components/ErrorFallback';
import App from './App.tsx';
import './index.css';
import './lib/i18n';

// Initialize Sentry after React is loaded to avoid duplicate React instances
initSentry();
initWebVitals();

// Build marker for cache debugging
// @ts-ignore — injected by Vite define
console.log('[CONGRESSAPP] Build:', __BUILD_TIME__);

// Detect preview vs production
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com');

const isPreview = isPreviewHost || isInIframe;

if (isPreview) {
  // Preview/iframe: unregister all service workers AND purge Cache Storage
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
} else {
  // Production: register the unified PWA service worker (Workbox + Push).
  // The SW itself lives at /sw.js (built from src/sw.ts via vite-plugin-pwa).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[CONGRESSAPP] SW registration failed:', err);
      });
    });
  }
}

// Clear stale error attempts after the app has been alive for >60s without crashing.
setTimeout(() => {
  try {
    sessionStorage.removeItem('errorReloadAttempts');
  } catch {
    /* ignore */
  }
}, 60_000);

createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary
    fallback={({ eventId }) => <ErrorFallback eventId={eventId} />}
  >
    <App />
  </Sentry.ErrorBoundary>
);

// Hide splash screen once React has painted the first frame.
// Two RAFs guarantee we wait for paint, not just commit.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('app-splash');
    if (!splash) return;
    splash.classList.add('is-hiding');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // Safety net in case transitionend never fires (e.g. reduced motion)
    setTimeout(() => splash.remove(), 600);
  });
});
