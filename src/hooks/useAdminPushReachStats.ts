import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { adminCommunicationsService } from '@/services/admin-communications.service';

interface PushReachStats {
  activeCount: number;
  totalConfirmed: number;
  percentage: number;
}

/**
 * Returns the number of confirmed attendees that have at least one active
 * Web Push subscription for this event. Used by the Admin Communications
 * page to show realistic reach for a "Send now" announcement.
 *
 * Note: push_subscriptions has UNIQUE (user_id, event_id), so count(*)
 * already maps 1:1 to unique attendees with notifications enabled.
 */
export function useAdminPushReachStats(eventId: string | undefined) {
  return useQuery<PushReachStats>({
    queryKey: ['admin-push-reach-stats', eventId],
    enabled: !!eventId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ count: activeCount, error }, totalConfirmed] = await Promise.all([
        supabase
          .from('push_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId!),
        adminCommunicationsService.getConfirmedAttendeesCount(eventId!),
      ]);

      if (error) throw new Error(error.message);

      const active = activeCount ?? 0;
      const total = totalConfirmed ?? 0;
      const percentage = total > 0 ? Math.round((active / total) * 100) : 0;

      return { activeCount: active, totalConfirmed: total, percentage };
    },
  });
}
