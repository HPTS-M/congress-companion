import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 1.0,
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/ucotwtuclnpsrmbbvrsk\.supabase\.co/,
      /^https:\/\/congress-companion\.vercel\.app/,
    ],
    beforeSend(event) {
      return event;
    },
  });
}

export { Sentry };
