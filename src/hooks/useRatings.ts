import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ratingsService, type Rating } from '@/services/ratings.service';

export function useUserRatings(eventId: string | undefined, attendeeId: string | undefined) {
  const query = useQuery({
    queryKey: ['ratings', eventId, attendeeId],
    queryFn: () => ratingsService.getUserRatings(eventId!, attendeeId!),
    enabled: !!eventId && !!attendeeId,
    staleTime: 5 * 60 * 1000,
  });

  const ratingsMap = new Map<string, Rating>();
  for (const r of query.data ?? []) {
    ratingsMap.set(r.session_id, r);
  }

  return { ...query, ratingsMap };
}

export function useSubmitRating(eventId: string | undefined, attendeeId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, stars, comment }: { sessionId: string; stars: number; comment: string | null }) =>
      ratingsService.upsertRating(eventId!, attendeeId!, sessionId, stars, comment),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['ratings', eventId, attendeeId] });
    },
  });
}
