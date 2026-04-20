export type SessionStatus = 'scheduled' | 'finished' | 'cancelled';

export interface SessionStatusInput {
  status?: string | null;
  scheduled_date: string;
  end_time?: string | null;
  start_time?: string | null;
}

/**
 * Estado híbrido de una sesión:
 * - 'cancelled' si el admin lo marcó manualmente.
 * - 'finished' si el end_time (o start_time como fallback) ya pasó.
 * - 'scheduled' en cualquier otro caso.
 */
export function getSessionStatus(s: SessionStatusInput): SessionStatus {
  if (s.status === 'cancelled') return 'cancelled';
  const time = s.end_time ?? s.start_time;
  if (!s.scheduled_date || !time) return 'scheduled';
  const iso = `${s.scheduled_date}T${time.length === 5 ? `${time}:00` : time}`;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'scheduled';
  return t < Date.now() ? 'finished' : 'scheduled';
}

export const STATUS_DOT_CLASS: Record<SessionStatus, string> = {
  scheduled: 'bg-emerald-500',
  finished: 'bg-orange-500',
  cancelled: 'bg-red-500',
};
