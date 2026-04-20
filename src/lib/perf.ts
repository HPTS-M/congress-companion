import * as Sentry from '@sentry/react';

/**
 * Wrap a critical async query so we capture timing as a Sentry breadcrumb
 * and report failures with a `perf_label` tag. Zero overhead when Sentry
 * is not initialized — addBreadcrumb is a no-op in that case.
 *
 * Usage:
 *   const data = await measure('list.sponsors', () => sponsorsService.getByEvent(id));
 */
export async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  try {
    const result = await fn();
    const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    Sentry.addBreadcrumb({
      category: 'perf',
      level: 'info',
      message: `perf.${label} ${duration.toFixed(0)}ms`,
      data: { duration_ms: Math.round(duration), label },
    });
    return result;
  } catch (err) {
    const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    Sentry.captureException(err, {
      tags: { perf_label: label },
      extra: { duration_ms: Math.round(duration) },
    });
    throw err;
  }
}

/**
 * Lightweight Web Vitals observer using only native PerformanceObserver.
 * Sends LCP, INP and CLS to Sentry as breadcrumbs. Safe to call once at
 * app start; bails out silently if APIs are missing.
 */
export function initWebVitals(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  const send = (name: string, value: number, extra?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({
      category: 'web-vitals',
      level: 'info',
      message: `${name} ${value.toFixed(0)}`,
      data: { name, value: Math.round(value), ...extra },
    });
  };

  // Largest Contentful Paint
  try {
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry | undefined;
      if (last) send('LCP', last.startTime);
    });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* noop */
  }

  // Cumulative Layout Shift
  try {
    let cls = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // @ts-expect-error — layout-shift entries are not typed in lib.dom
        if (!entry.hadRecentInput) cls += (entry as { value: number }).value;
      }
      send('CLS', cls * 1000);
    });
    po.observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* noop */
  }

  // Interaction to Next Paint (approximation via 'event' entries)
  try {
    let worst = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const dur = (entry as PerformanceEntry).duration;
        if (dur > worst) {
          worst = dur;
          send('INP', worst, { name: entry.name });
        }
      }
    });
    // @ts-expect-error — 'event' entry type is supported in modern browsers
    po.observe({ type: 'event', buffered: true, durationThreshold: 40 });
  } catch {
    /* noop */
  }
}
