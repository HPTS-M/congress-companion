import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checkinService } from '@/services/checkin.service';

export function useRecentCheckins(attendeeId: string | undefined) {
  const query = useQuery({
    queryKey: ['recent-checkins', attendeeId],
    queryFn: () => checkinService.getRecentCheckins(attendeeId!),
    enabled: !!attendeeId,
    staleTime: 60 * 1000,
  });

  return query;
}

export function usePerformCheckin(attendeeId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId }: { activityId: string }) =>
      checkinService.performCheckin(activityId, attendeeId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-checkins', attendeeId] });
      queryClient.invalidateQueries({ queryKey: ['user-checkins', attendeeId] });
    },
  });
}

export function useEventActivities(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-activities-list', eventId],
    queryFn: () => checkinService.getEventActivities(eventId!),
    enabled: !!eventId,
  });
}
