import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';

export function useAdminDashboard(eventId: string | undefined) {
  const statsQuery = useQuery({
    queryKey: ['admin-stats', eventId],
    queryFn: () => adminService.getEventStats(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });

  const announcementsQuery = useQuery({
    queryKey: ['admin-recent-announcements', eventId],
    queryFn: () => adminService.getRecentAnnouncements(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });

  return { stats: statsQuery, recentAnnouncements: announcementsQuery };
}
