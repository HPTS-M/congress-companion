import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAgendaService, type SessionFormData } from '@/services/admin-agenda.service';
import type { EventActivity } from '@/types';
import { useMemo } from 'react';

export function useAdminActivities(eventId: string | undefined) {
  const query = useQuery({
    queryKey: ['admin-activities', eventId],
    queryFn: () => adminAgendaService.getActivities(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
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

  const rooms = useMemo(() => {
    const set = new Set<string>();
    for (const a of query.data ?? []) {
      if (a.location) set.add(a.location);
    }
    return Array.from(set).sort();
  }, [query.data]);

  return { ...query, grouped, sortedDates, rooms };
}

export function useAdminInterestCounts(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-interest-counts', eventId],
    queryFn: () => adminAgendaService.getInterestCounts(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminCheckinCounts(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-checkin-counts', eventId],
    queryFn: () => adminAgendaService.getCheckinCounts(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: SessionFormData) => adminAgendaService.createSession(eventId!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-activities', eventId] });
    },
  });
}

export function useUpdateSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, form }: { sessionId: string; form: Partial<SessionFormData> }) =>
      adminAgendaService.updateSession(sessionId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-activities', eventId] });
    },
  });
}

export function useDeleteSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminAgendaService.deleteSession(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-activities', eventId] });
    },
  });
}

export function useDuplicateSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (session: EventActivity) => adminAgendaService.duplicateSession(session),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-activities', eventId] });
    },
  });
}

export function useDuplicateDay(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromDate, toDate }: { fromDate: string; toDate: string }) =>
      adminAgendaService.duplicateDay(eventId!, fromDate, toDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-activities', eventId] });
    },
  });
}
