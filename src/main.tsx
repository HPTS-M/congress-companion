import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { initSentry } from '@/lib/sentry';
import App from './App.tsx';
import './index.css';
import './lib/i18n';

// Initialize Sentry after React is loaded to avoid duplicate React instances
initSentry();

// Build marker for cache debugging
console.log('[CONGRÉSSAPP] Build:', (globalThis as any).__BUILD_TIME__ ?? 'dev');

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
  // Production: register PWA service worker manually
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js');
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong</p>}>
    <App />
  </Sentry.ErrorBoundary>
);
