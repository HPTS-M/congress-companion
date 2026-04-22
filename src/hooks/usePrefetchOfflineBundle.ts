import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { agendaService } from '@/services/agenda.service';
import { sponsorsService } from '@/services/sponsors.service';
import { documentsService } from '@/services/documents.service';
import { ticketsService } from '@/services/tickets.service';

/**
 * Silently prefetch the offline bundle right after login.
 * Runs once per (attendeeId, eventId) tuple. Failures are swallowed —
 * this is a best-effort UX upgrade, not a blocking step.
 */
export function usePrefetchOfflineBundle(): void {
  const qc = useQueryClient();
  const { attendee } = useAuth();
  const attendeeId = attendee?.id;
  const eventId = attendee?.event_id;
  const ranForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!attendeeId || !eventId) return;
    const key = `${attendeeId}:${eventId}`;
    if (ranForRef.current === key) return;
    ranForRef.current = key;

    // Don't bother prefetching if we're already offline.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const tasks: Promise<unknown>[] = [
      qc.prefetchQuery({
        queryKey: ['activities', eventId],
        queryFn: () => agendaService.getActivities(eventId),
        staleTime: 5 * 60 * 1000,
      }),
      qc.prefetchQuery({
        queryKey: ['session-interests', eventId],
        queryFn: () => agendaService.getInterestCounts(eventId),
        staleTime: 60 * 1000,
      }),
      qc.prefetchQuery({
        queryKey: ['user-interests', eventId, attendeeId],
        queryFn: () => agendaService.getUserInterests(eventId, attendeeId),
        staleTime: 60 * 1000,
      }),
      qc.prefetchQuery({
        queryKey: ['user-checkins', attendeeId],
        queryFn: () => agendaService.getUserCheckins(attendeeId),
        staleTime: 60 * 1000,
      }),
      qc.prefetchQuery({
        queryKey: ['sponsors', eventId],
        queryFn: () => sponsorsService.getByEvent(eventId),
        staleTime: 5 * 60 * 1000,
      }),
      qc.prefetchQuery({
        queryKey: ['documents', eventId],
        queryFn: () => documentsService.getByEvent(eventId),
        staleTime: 5 * 60 * 1000,
      }),
      qc.prefetchQuery({
        queryKey: ['tickets', attendeeId],
        queryFn: () => ticketsService.getByAttendee(attendeeId),
        staleTime: 5 * 60 * 1000,
      }),
    ];

    Promise.allSettled(tasks).catch(() => {
      /* best-effort */
    });
  }, [qc, attendeeId, eventId]);
}
