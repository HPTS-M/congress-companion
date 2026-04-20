import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAttendeesService, type CreateAttendeeData, type AddServiceData, type AttendeeFilters, type BulkAttendeeRow } from '@/services/admin-attendees.service';
import { useEvent } from '@/hooks/useEvent';

export type UpsertResolution =
  | { rowIndex: number; action: 'create' }
  | { rowIndex: number; action: 'update'; targetAttendeeId: string }
  | { rowIndex: number; action: 'skip' };

async function clearAttendeesSWCache() {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((n) => n.includes('supabase-data-cache') || n.includes('attendees'))
        .map(async (name) => {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          await Promise.all(
            keys
              .filter((req) => req.url.includes('/attendees'))
              .map((req) => cache.delete(req))
          );
        })
    );
  } catch {
    // ignore SW cache errors
  }
}

export function useAdminAttendees(search?: string, statusFilter?: string, filters?: AttendeeFilters) {
  const { event } = useEvent();
  const eventId = event?.id ?? '';

  // Stable serialization of filters for queryKey
  const filtersKey = filters
    ? JSON.stringify({
        s: filters.specialties?.slice().sort() ?? [],
        i: filters.institutions?.slice().sort() ?? [],
        h: filters.hasServices ?? null,
      })
    : '';

  const attendeesQuery = useQuery({
    queryKey: ['admin-attendees', eventId, search, statusFilter, filtersKey],
    queryFn: () => adminAttendeesService.getAttendees(eventId, search, statusFilter, filters),
    enabled: !!eventId,
    staleTime: 30_000,
  });

  const countsQuery = useQuery({
    queryKey: ['admin-attendees-counts', eventId],
    queryFn: () => adminAttendeesService.getCounts(eventId),
    enabled: !!eventId,
    staleTime: 60_000,
  });

  return {
    attendees: attendeesQuery.data ?? [],
    isLoading: attendeesQuery.isLoading,
    isFetching: attendeesQuery.isFetching,
    isRefetching: attendeesQuery.isFetching && !attendeesQuery.isLoading,
    counts: countsQuery.data ?? { total: 0, confirmed: 0, pending: 0 },
    isCountsLoading: countsQuery.isLoading,
    refetch: attendeesQuery.refetch,
  };
}

export function useAttendeeFilterOptions() {
  const { event } = useEvent();
  const eventId = event?.id ?? '';

  return useQuery({
    queryKey: ['admin-attendee-filter-options', eventId],
    queryFn: () => adminAttendeesService.getFilterOptions(eventId),
    enabled: !!eventId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateAttendee() {
  const queryClient = useQueryClient();
  const { event } = useEvent();

  return useMutation({
    mutationFn: (data: Omit<CreateAttendeeData, 'event_id'>) =>
      adminAttendeesService.createAttendee({ ...data, event_id: event!.id }),
    onSuccess: async () => {
      await clearAttendeesSWCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendee-filter-options'] }),
      ]);
    },
  });
}

export function useBulkCreateAttendees() {
  const queryClient = useQueryClient();
  const { event } = useEvent();

  return useMutation({
    mutationFn: ({ rows, registrationStatus }: { rows: BulkAttendeeRow[]; registrationStatus?: string }) =>
      adminAttendeesService.bulkCreateAttendees(event!.id, rows, registrationStatus),
    onSuccess: async () => {
      await clearAttendeesSWCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendee-filter-options'] }),
      ]);
    },
  });
}

export function useBulkUpsertAttendees() {
  const queryClient = useQueryClient();
  const { event } = useEvent();

  return useMutation({
    mutationFn: ({
      rows,
      resolutions,
      registrationStatus,
    }: {
      rows: BulkAttendeeRow[];
      resolutions: UpsertResolution[];
      registrationStatus?: string;
    }) =>
      adminAttendeesService.bulkUpsertAttendees(event!.id, rows, resolutions, registrationStatus),
    onSuccess: async () => {
      await clearAttendeesSWCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendee-filter-options'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-existing-emails'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-existing-external-codes'] }),
      ]);
    },
  });
}

export function useUpdateAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminAttendeesService.updateAttendee>[1] }) =>
      adminAttendeesService.updateAttendee(id, data),
    onSuccess: async (_, variables) => {
      await clearAttendeesSWCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail', variables.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendee-filter-options'] }),
      ]);
    },
  });
}

export function useUpdateAttendeeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminAttendeesService.updateAttendeeStatus(id, status),
    onSuccess: async (_, variables) => {
      await clearAttendeesSWCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail', variables.id] }),
      ]);
    },
  });
}

export function useDeleteAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attendeeId: string) => adminAttendeesService.deleteAttendee(attendeeId),
    onSuccess: async () => {
      await clearAttendeesSWCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] }),
      ]);
    },
  });
}

export function useAttendeeDetail(attendeeId: string | null) {
  return useQuery({
    queryKey: ['admin-attendee-detail', attendeeId],
    queryFn: () => adminAttendeesService.getAttendeeDetail(attendeeId!),
    enabled: !!attendeeId,
  });
}

export function useAddService() {
  const queryClient = useQueryClient();
  const { event } = useEvent();

  return useMutation({
    mutationFn: ({ attendeeId, data }: { attendeeId: string; data: AddServiceData }) =>
      adminAttendeesService.addServiceToAttendee(attendeeId, event!.id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail', variables.attendeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
    },
  });
}

export function useUpdateServiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serviceId, status }: { serviceId: string; status: string }) =>
      adminAttendeesService.updateServiceStatus(serviceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail'] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceId: string) => adminAttendeesService.deleteService(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
    },
  });
}

export function useDataQuality() {
  const { event } = useEvent();
  const eventId = event?.id ?? '';

  return useQuery({
    queryKey: ['admin-data-quality', eventId],
    queryFn: () => adminAttendeesService.getDataQuality(eventId),
    enabled: !!eventId,
    staleTime: 30000,
  });
}

export function useExistingEmails() {
  const { event } = useEvent();
  const eventId = event?.id ?? '';

  return useQuery({
    queryKey: ['admin-existing-emails', eventId],
    queryFn: () => adminAttendeesService.getExistingEmails(eventId),
    enabled: !!eventId,
  });
}

export function useExistingExternalCodes() {
  const { event } = useEvent();
  const eventId = event?.id ?? '';

  return useQuery({
    queryKey: ['admin-existing-external-codes', eventId],
    queryFn: () => adminAttendeesService.getExistingExternalCodes(eventId),
    enabled: !!eventId,
  });
}

export function useSendInvitations() {
  const queryClient = useQueryClient();
  const { event } = useEvent();

  return useMutation({
    mutationFn: (attendeeIds: string[]) => {
      if (!event?.id) {
        throw new Error('Event not loaded — cannot send invitations');
      }
      return adminAttendeesService.sendInvitations(attendeeIds, event.id);
    },
    onSuccess: async () => {
      await clearAttendeesSWCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-pending-invitations'] }),
      ]);
    },
  });
}

/**
 * IDs of attendees in the current event with no invitation yet AND a valid email.
 * Used to power the "Retry pending credentials" action.
 */
export function usePendingInvitations() {
  const { event } = useEvent();
  const eventId = event?.id ?? '';

  return useQuery({
    queryKey: ['admin-pending-invitations', eventId],
    queryFn: () => adminAttendeesService.getPendingInvitationIds(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
  });
}
