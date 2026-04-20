import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ratingsService, type Rating } from '@/services/ratings.service';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function useUserRatings(eventId: string | undefined, attendeeId: string | undefined) {
  const isOnline = useOnlineStatus();

  useRealtimeInvalidate({
    channelName: `ratings-${eventId}-${attendeeId}`,
    table: 'ratings',
    filter: attendeeId ? `user_id=eq.${attendeeId}` : undefined,
    queryKeys: [['ratings', eventId, attendeeId]],
    enabled: !!eventId && !!attendeeId && isOnline,
  });

  const query = useQuery({
    queryKey: ['ratings', eventId, attendeeId],
    queryFn: () => ratingsService.getUserRatings(eventId!, attendeeId!),
    enabled: !!eventId && !!attendeeId,
    staleTime: 30_000,
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
