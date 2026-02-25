import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminCommunicationsService } from '@/services/admin-communications.service';

export function useAdminAnnouncements(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-announcements', eventId],
    queryFn: () => adminCommunicationsService.getAnnouncements(eventId!),
    enabled: !!eventId,
  });
}

export function useAdminCommsStats(eventId: string | undefined) {
  const totalQuery = useQuery({
    queryKey: ['admin-announcements-count', eventId],
    queryFn: () => adminCommunicationsService.getAnnouncements(eventId!).then((d) => d.length),
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

export function useCreateAnnouncement(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) =>
      adminCommunicationsService.createAnnouncement(eventId!, title, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements', eventId] });
      qc.invalidateQueries({ queryKey: ['admin-announcements-count', eventId] });
      qc.invalidateQueries({ queryKey: ['admin-announcements-today', eventId] });
      qc.invalidateQueries({ queryKey: ['admin-stats', eventId] });
    },
  });
}

export function useDeleteAnnouncement(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCommunicationsService.deleteAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements', eventId] });
      qc.invalidateQueries({ queryKey: ['admin-announcements-count', eventId] });
    },
  });
}

export function useAdminGroupChat(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-group-chat', eventId],
    queryFn: () => adminCommunicationsService.getGroupChatMessages(eventId!),
    enabled: !!eventId,
  });
}

export function useAdminAttendeeNames(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-attendee-names', eventId],
    queryFn: () => adminCommunicationsService.getAttendeeNames(eventId!),
    enabled: !!eventId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDeleteChatMessage(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => adminCommunicationsService.deleteMessage(messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-group-chat', eventId] });
    },
  });
}
