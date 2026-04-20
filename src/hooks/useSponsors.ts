import { useQuery } from '@tanstack/react-query';
import { sponsorsService } from '@/services/sponsors.service';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function useSponsors(eventId: string) {
  const isOnline = useOnlineStatus();

  useRealtimeInvalidate({
    channelName: `sponsors-${eventId}`,
    table: 'sponsors',
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    queryKeys: [['sponsors', eventId]],
    enabled: !!eventId && isOnline,
  });

  return useQuery({
    queryKey: ['sponsors', eventId],
    queryFn: () => sponsorsService.getByEvent(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

export function useSponsor(sponsorId: string) {
  return useQuery({
    queryKey: ['sponsor', sponsorId],
    queryFn: () => sponsorsService.getById(sponsorId),
    enabled: !!sponsorId,
    staleTime: 10 * 60 * 1000,
  });
}
