import { useQuery } from '@tanstack/react-query';
import { ticketsService } from '@/services/tickets.service';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function useTickets(attendeeId: string | undefined) {
  const isOnline = useOnlineStatus();

  useRealtimeInvalidate({
    channelName: `attendee-services-${attendeeId}`,
    table: 'attendee_services',
    filter: attendeeId ? `attendee_id=eq.${attendeeId}` : undefined,
    queryKeys: [['tickets', attendeeId]],
    enabled: !!attendeeId && isOnline,
  });

  // service_tickets has no attendee_id column, so no filter — invalidate on any change.
  // Volume is low and the listener is event-specific via attendeeId presence.
  useRealtimeInvalidate({
    channelName: `service-tickets-${attendeeId}`,
    table: 'service_tickets',
    queryKeys: [['tickets', attendeeId]],
    enabled: !!attendeeId && isOnline,
  });

  return useQuery({
    queryKey: ['tickets', attendeeId],
    queryFn: () => ticketsService.getByAttendee(attendeeId!),
    enabled: !!attendeeId,
    staleTime: 30_000,
  });
}
