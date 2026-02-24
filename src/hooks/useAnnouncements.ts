import { useQuery } from '@tanstack/react-query';
import { announcementsService } from '@/services/announcements.service';

export function useAnnouncements(eventId: string) {
  return useQuery({
    queryKey: ['announcements', eventId],
    queryFn: () => announcementsService.getByEvent(eventId),
    enabled: !!eventId,
  });
}
