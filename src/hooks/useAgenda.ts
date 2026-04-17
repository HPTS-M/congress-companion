import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agendaService } from '@/services/agenda.service';
import type { EventActivity, SessionInterest } from '@/types';
import { useMemo } from 'react';

export function useActivities(eventId: string | undefined) {
  const query = useQuery({
    queryKey: ['activities', eventId],
    queryFn: () => agendaService.getActivities(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, EventActivity[]>();
    for (const a of query.data ?? []) {
      const list = map.get(a.scheduled_date) ?? [];
      list.push(a);
      map.set(a.scheduled_date, list);
    }
    return map;
  }, [query.data]);

  const sortedDates = useMemo(
    () => Array.from(grouped.keys()).sort(),
    [grouped],
  );

  return { ...query, grouped, sortedDates };
}

export function useSessionInterests(eventId: string | undefined) {
  const query = useQuery({
    queryKey: ['session-interests', eventId],
    queryFn: () => agendaService.getInterestCounts(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });

  const countMap = query.data ?? new Map<string, number>();

  return { ...query, countMap };
}

export function useUserInterests(eventId: string | undefined, attendeeId: string | undefined) {
  const query = useQuery({
    queryKey: ['user-interests', eventId, attendeeId],
    queryFn: () => agendaService.getUserInterests(eventId!, attendeeId!),
    enabled: !!eventId && !!attendeeId,
    staleTime: 5 * 60 * 1000,
  });

  const sessionIds = useMemo(
    () => new Set((query.data ?? []).map((i) => i.session_id)),
    [query.data],
  );

  return { ...query, sessionIds };
}

export function useUserCheckins(attendeeId: string | undefined) {
  const query = useQuery({
    queryKey: ['user-checkins', attendeeId],
    queryFn: () => agendaService.getUserCheckins(attendeeId!),
    enabled: !!attendeeId,
    staleTime: 5 * 60 * 1000,
  });

  const checkedInIds = useMemo(
    () => new Set(query.data ?? []),
    [query.data],
  );

  return { ...query, checkedInIds };
}

export function useToggleInterest(eventId: string | undefined, attendeeId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, isInterested }: { sessionId: string; isInterested: boolean }) =>
      agendaService.toggleInterest(eventId!, sessionId, attendeeId!, isInterested),
    onMutate: async ({ sessionId, isInterested }) => {
      await qc.cancelQueries({ queryKey: ['user-interests', eventId, attendeeId] });
      await qc.cancelQueries({ queryKey: ['session-interests', eventId] });

      const prevUser = qc.getQueryData<SessionInterest[]>(['user-interests', eventId, attendeeId]);
      const prevCounts = qc.getQueryData<Map<string, number>>(['session-interests', eventId]);

      // Optimistic user interests
      if (isInterested) {
        qc.setQueryData<SessionInterest[]>(
          ['user-interests', eventId, attendeeId],
          (old) => (old ?? []).filter((i) => i.session_id !== sessionId),
        );
      } else {
        qc.setQueryData<SessionInterest[]>(
          ['user-interests', eventId, attendeeId],
          (old) => [
            ...(old ?? []),
            { id: 'optimistic', event_id: eventId!, session_id: sessionId, user_id: attendeeId!, created_at: null },
          ],
        );
      }

      // Optimistic count delta
      if (prevCounts) {
        const next = new Map(prevCounts);
        const cur = next.get(sessionId) ?? 0;
        next.set(sessionId, Math.max(0, cur + (isInterested ? -1 : 1)));
        qc.setQueryData(['session-interests', eventId], next);
      }

      return { prevUser, prevCounts };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevUser) qc.setQueryData(['user-interests', eventId, attendeeId], context.prevUser);
      if (context?.prevCounts) qc.setQueryData(['session-interests', eventId], context.prevCounts);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['user-interests', eventId, attendeeId] });
      qc.invalidateQueries({ queryKey: ['session-interests', eventId] });
    },
  });
}
