import { useQuery } from '@tanstack/react-query';
import { ticketsService } from '@/services/tickets.service';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function useTickets(attendeeId: string | undefined) {
  const isOnline = useOnlineStatus();

  // Single subscription scoped to this attendee. service_tickets has no
  // attendee_id column, so subscribing to it globally would invalidate on
  // every change in the database. Instead we rely on attendee_services
  // changes (status flips when a ticket is validated).
  useRealtimeInvalidate({
    channelName: `attendee-services-${attendeeId}`,
    table: 'attendee_services',
    filter: attendeeId ? `attendee_id=eq.${attendeeId}` : undefined,
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
