import { useQuery } from '@tanstack/react-query';
import { ticketsService } from '@/services/tickets.service';

export function useTickets(attendeeId: string | undefined) {
  return useQuery({
    queryKey: ['tickets', attendeeId],
    queryFn: () => ticketsService.getByAttendee(attendeeId!),
    enabled: !!attendeeId,
    staleTime: 5 * 60 * 1000,
  });
}
