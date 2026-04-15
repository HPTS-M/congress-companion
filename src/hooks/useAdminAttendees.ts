import { useEvent } from '@/hooks/useEvent';
import { adminAttendeesService, type AddServiceData, type CreateAttendeeData, type UpdateAttendeeData } from '@/services/admin-attendees.service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
    mutationFn: ({ rows, registrationStatus }: { rows: { full_name: string; email: string; specialty?: string; institution?: string }[]; registrationStatus?: string }) =>
      adminAttendeesService.bulkCreateAttendees(event!.id, rows, registrationStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees-counts'] });
    },
  });
}

export function useUpdateAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ attendeeId, data }: { attendeeId: string; data: UpdateAttendeeData }) =>
      adminAttendeesService.updateAttendee(attendeeId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail', variables.attendeeId] });
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

export function useSendInvitations() {
  const queryClient = useQueryClient();
  const { event } = useEvent();

  return useMutation({
    mutationFn: (attendeeIds: string[]) =>
      adminAttendeesService.sendInvitations(attendeeIds, event!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
    },
  });
}
