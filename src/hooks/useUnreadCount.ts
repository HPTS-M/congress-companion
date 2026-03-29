import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { announcementsService } from '@/services/announcements.service';
import { messagingService } from '@/services/messaging.service';
import { useCallback } from 'react';

export function useUnreadCount(eventId: string) {
  const { attendee } = useAuth();
  const queryClient = useQueryClient();
  const storageKey = `notifications_last_seen_${attendee?.id}`;

  const getLastSeen = (): Date => {
    const stored = localStorage.getItem(storageKey);
    return stored ? new Date(stored) : new Date(0);
  };

  const markAsSeen = useCallback(() => {
    localStorage.setItem(storageKey, new Date().toISOString());
    queryClient.invalidateQueries({ queryKey: ['unread-count', eventId, attendee?.id] });
  }, [storageKey, queryClient, eventId, attendee?.id]);

  const { data } = useQuery({
    queryKey: ['unread-count', eventId, attendee?.id],
    queryFn: async () => {
      const lastSeen = getLastSeen();

      const announcements = await announcementsService.getByEvent(eventId);
      const unreadAnnouncements = announcements.filter(
        (a) => a.sent_at && new Date(a.sent_at) > lastSeen
      ).length;

      const conversations = await messagingService.getDirectConversations(eventId, attendee!.id);
      const pendingInvites = conversations.filter(
        (c) => c.status === 'pending' && c.other_id !== attendee!.id
      ).length;
      const unreadMessages = conversations.filter(
        (c) =>
          c.status === 'active' &&
          c.last_message_at &&
          new Date(c.last_message_at) > lastSeen
      ).length;

      return {
        unreadAnnouncements,
        pendingInvites,
        unreadMessages,
        total: unreadAnnouncements + pendingInvites + unreadMessages,
      };
    },
    enabled: !!attendee?.id && !!eventId,
    refetchInterval: 30_000,
  });

  return {
    unreadCount: data?.total ?? 0,
    pendingInvites: data?.pendingInvites ?? 0,
    unreadAnnouncements: data?.unreadAnnouncements ?? 0,
    unreadMessages: data?.unreadMessages ?? 0,
    markAsSeen,
  };
}
