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

export function useAdminArchivedActivities(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-archived-activities', eventId],
    queryFn: () => adminAgendaService.getArchivedActivities(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });
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

async function invalidateAgenda(qc: ReturnType<typeof useQueryClient>, eventId: string | undefined) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['admin-activities', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-archived-activities', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-interest-counts', eventId] }),
    qc.invalidateQueries({ queryKey: ['admin-checkin-counts', eventId] }),
  ]);
}

export function useCreateSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: SessionFormData) => adminAgendaService.createSession(eventId!, form),
    onSuccess: async () => {
      await invalidateAgenda(qc, eventId);
    },
  });
}

export function useUpdateSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, form }: { sessionId: string; form: Partial<SessionFormData> }) =>
      adminAgendaService.updateSession(sessionId, form),
    onSuccess: async () => {
      await invalidateAgenda(qc, eventId);
    },
  });
}

export function useDeleteSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminAgendaService.deleteSession(sessionId),
    onSuccess: async () => {
      await invalidateAgenda(qc, eventId);
    },
  });
}

export function useArchiveSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminAgendaService.archiveSession(sessionId),
    onSuccess: async () => {
      await invalidateAgenda(qc, eventId);
    },
  });
}

export function useRestoreSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => adminAgendaService.restoreSession(sessionId),
    onSuccess: async () => {
      await invalidateAgenda(qc, eventId);
    },
  });
}

export function useReorderSessions(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number; start_time?: string; location?: string }[]) =>
      adminAgendaService.reorderSessions(updates),
    onSuccess: async () => {
      await invalidateAgenda(qc, eventId);
    },
  });
}

export function useDuplicateSession(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (session: EventActivity) => adminAgendaService.duplicateSession(session),
    onSuccess: async () => {
      await invalidateAgenda(qc, eventId);
    },
  });
}

export function useDuplicateDay(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromDate, toDate }: { fromDate: string; toDate: string }) =>
      adminAgendaService.duplicateDay(eventId!, fromDate, toDate),
    onSuccess: async () => {
      await invalidateAgenda(qc, eventId);
    },
  });
}
