import { useQuery } from '@tanstack/react-query';
import { sponsorsService } from '@/services/sponsors.service';

export function useSponsors(eventId: string) {
  return useQuery({
    queryKey: ['sponsors', eventId],
    queryFn: () => sponsorsService.getByEvent(eventId),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
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
