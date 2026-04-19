import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminCommunicationsService } from '@/services/admin-communications.service';

export function useAdminAnnouncements(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-announcements', eventId],
    queryFn: () => adminCommunicationsService.getAnnouncements(eventId!),
    enabled: !!eventId,
    refetchInterval: 30_000,
  });
}

export function useAdminCommsStats(eventId: string | undefined) {
  const totalQuery = useQuery({
    queryKey: ['admin-announcements-count', eventId],
    queryFn: () => adminCommunicationsService.getAnnouncementsCount(eventId!),
    enabled: !!eventId,
  });

  const todayQuery = useQuery({
    queryKey: ['admin-announcements-today', eventId],
    queryFn: () => adminCommunicationsService.getTodayAnnouncementsCount(eventId!),
    enabled: !!eventId,
  });

  const attendeesQuery = useQuery({
    queryKey: ['admin-confirmed-attendees-count', eventId],
    queryFn: () => adminCommunicationsService.getConfirmedAttendeesCount(eventId!),
    enabled: !!eventId,
  });

  return { total: totalQuery, today: todayQuery, attendees: attendeesQuery };
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, eventId: string | undefined) {
  qc.invalidateQueries({ queryKey: ['admin-announcements', eventId] });
  qc.invalidateQueries({ queryKey: ['admin-announcements-count', eventId] });
  qc.invalidateQueries({ queryKey: ['admin-announcements-today', eventId] });
  qc.invalidateQueries({ queryKey: ['admin-stats', eventId] });
}

export function useCreateAnnouncement(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; body: string; scheduledFor?: Date | null }) =>
      adminCommunicationsService.createAnnouncement(eventId!, payload),
    onSuccess: () => invalidateAll(qc, eventId),
  });
}

export function useUpdateAnnouncement(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { title: string; body: string; scheduledFor?: Date | null } }) =>
      adminCommunicationsService.updateAnnouncement(id, fields),
    onSuccess: () => invalidateAll(qc, eventId),
  });
}

export function useResendAnnouncement(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, body }: { id: string; title: string; body: string }) =>
      adminCommunicationsService.resendAnnouncement(id, title, body),
    onSuccess: () => invalidateAll(qc, eventId),
  });
}

export function useCancelScheduled(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCommunicationsService.cancelScheduled(id),
    onSuccess: () => invalidateAll(qc, eventId),
  });
}

export function useDeleteAnnouncement(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCommunicationsService.deleteAnnouncement(id),
    onSuccess: () => invalidateAll(qc, eventId),
  });
}
