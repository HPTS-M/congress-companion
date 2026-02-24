import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAttendeesService, type CreateAttendeeData } from '@/services/admin-attendees.service';
import { useEvent } from '@/hooks/useEvent';

export function useAdminAttendees(search?: string, statusFilter?: string) {
  const { event } = useEvent();
  const eventId = event?.id ?? '';

  const attendeesQuery = useQuery({
    queryKey: ['admin-attendees', eventId, search, statusFilter],
    queryFn: () => adminAttendeesService.getAttendees(eventId, search, statusFilter),
    enabled: !!eventId,
  });

  const countsQuery = useQuery({
    queryKey: ['admin-attendees-counts', eventId],
    queryFn: () => adminAttendeesService.getCounts(eventId),
    enabled: !!eventId,
  });

  return {
    attendees: attendeesQuery.data ?? [],
    isLoading: attendeesQuery.isLoading,
    counts: countsQuery.data ?? { total: 0, confirmed: 0, pending: 0 },
    isCountsLoading: countsQuery.isLoading,
    refetch: attendeesQuery.refetch,
  };
}

export function useCreateAttendee() {
  const queryClient = useQueryClient();
  const { event } = useEvent();

  return useMutation({
    mutationFn: (data: Omit<CreateAttendeeData, 'event_id'>) =>
      adminAttendeesService.createAttendee({ ...data, event_id: event!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] });
    },
  });
}

export function useBulkCreateAttendees() {
  const queryClient = useQueryClient();
  const { event } = useEvent();

  return useMutation({
    mutationFn: (rows: { full_name: string; email: string; specialty?: string; institution?: string }[]) =>
      adminAttendeesService.bulkCreateAttendees(event!.id, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] });
    },
  });
}

export function useDeleteAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attendeeId: string) => adminAttendeesService.deleteAttendee(attendeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] });
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
