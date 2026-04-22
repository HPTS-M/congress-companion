import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { agendaService } from '@/services/agenda.service';
import { ticketsService } from '@/services/tickets.service';
import { sponsorsService } from '@/services/sponsors.service';
import { pollsService } from '@/services/polls.service';
import { contactsService } from '@/services/contacts.service';

const STALE = 30_000;

/**
 * Prefetch hook for attendee navigation.
 *
 * Each handler triggers two parallel side effects:
 *   1. Dynamic `import()` of the destination page chunk (fire-and-forget — Vite
 *      analyzes this statically and starts the chunk download in parallel).
 *   2. TanStack Query `prefetchQuery` for the page's primary data.
 *
 * IMPORTANT: `prefetchQuery` does NOT support an `enabled` option. We guard
 * dependent prefetchers (tickets, polls) manually by returning `Promise.resolve()`
 * when the required attendee id is missing.
 *
 * Excluded from prefetch (intentionally): messaging, announcements — both have
 * realtime subscriptions that keep their caches warm; prefetch would be redundant.
 */
export function usePrefetch(eventId: string, attendeeId?: string) {
  const qc = useQueryClient();

  return useMemo(
    () => ({
      agenda: () => {
        // Fire-and-forget chunk download (parallel to data prefetch)
        void import('@/pages/attendee/Agenda');
        if (!eventId) return Promise.resolve();
        return qc.prefetchQuery({
          queryKey: ['activities', eventId],
          queryFn: () => agendaService.getActivities(eventId),
          staleTime: STALE,
        });
      },

      tickets: () => {
        void import('@/pages/attendee/Tickets');
        // Manual guard: prefetchQuery has no `enabled` option
        return attendeeId
          ? qc.prefetchQuery({
              queryKey: ['tickets', attendeeId],
              queryFn: () => ticketsService.getByAttendee(attendeeId),
              staleTime: STALE,
            })
          : Promise.resolve();
      },

      sponsors: () => {
        void import('@/pages/attendee/Commercial');
        if (!eventId) return Promise.resolve();
        return qc.prefetchQuery({
          queryKey: ['sponsors', eventId],
          queryFn: () => sponsorsService.getByEvent(eventId),
          staleTime: STALE,
        });
      },

      polls: () => {
        void import('@/pages/attendee/Polls');
        return eventId && attendeeId
          ? qc.prefetchQuery({
              queryKey: ['attendee-polls', eventId, attendeeId],
              queryFn: () => pollsService.getActivePolls(eventId, attendeeId),
              staleTime: STALE,
            })
          : Promise.resolve();
      },

      contacts: () => {
        void import('@/pages/attendee/Contacts');
        if (!eventId) return Promise.resolve();
        return qc.prefetchQuery({
          queryKey: ['eventAttendees', eventId],
          queryFn: () => contactsService.getEventAttendees(eventId),
          staleTime: STALE,
        });
      },
    }),
    [qc, eventId, attendeeId],
  );
}

export type PrefetchKey = keyof ReturnType<typeof usePrefetch>;
