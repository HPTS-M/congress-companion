import { Sentry } from '@/lib/sentry';

export function logSupabaseQuery(
  table: string,
  operation: string,
  durationMs: number,
  error?: unknown
) {
  Sentry.addBreadcrumb({
    category: 'supabase',
    message: `${operation} ${table} (${durationMs}ms)`,
    level: error ? 'error' : 'info',
    data: { table, operation, durationMs, error },
  });

  if (error) {
    Sentry.captureException(error, { extra: { table, operation } });
  }
}
