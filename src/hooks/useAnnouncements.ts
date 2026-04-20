import { useQuery } from '@tanstack/react-query';
import { announcementsService } from '@/services/announcements.service';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuth } from '@/hooks/useAuth';

export function useAnnouncements(eventId: string) {
  const { attendee } = useAuth();
  const isOnline = useOnlineStatus();
  const attendeeId = attendee?.id;

  useRealtimeInvalidate({
    channelName: `announcements-${eventId}`,
    table: 'announcements',
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    queryKeys: [
      ['announcements', eventId],
      ['unread-announcements', eventId, attendeeId],
    ],
    enabled: !!eventId && isOnline,
  });

  return useQuery({
    queryKey: ['announcements', eventId],
    queryFn: () => announcementsService.getByEvent(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
  });
}
