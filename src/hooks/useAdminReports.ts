import { useQuery } from '@tanstack/react-query';
import { adminReportsService } from '@/services/admin-reports.service';

export function useAdminReports(eventId: string | undefined) {
  const summary = useQuery({
    queryKey: ['admin-reports-summary', eventId],
    queryFn: () => adminReportsService.getSummaryStats(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });

  const attendance = useQuery({
    queryKey: ['admin-reports-attendance', eventId],
    queryFn: () => adminReportsService.getAttendance(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });

  const ratings = useQuery({
    queryKey: ['admin-reports-ratings', eventId],
    queryFn: () => adminReportsService.getRatings(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });

  const logistics = useQuery({
    queryKey: ['admin-reports-logistics', eventId],
    queryFn: () => adminReportsService.getLogistics(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });

  const sponsorEngagement = useQuery({
    queryKey: ['admin-reports-sponsors', eventId],
    queryFn: () => adminReportsService.getSponsorEngagement(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });

  const pollResponses = useQuery({
    queryKey: ['admin-reports-poll-responses', eventId],
    queryFn: () => adminReportsService.getPollResponses(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });

  return { summary, attendance, ratings, logistics, sponsorEngagement, pollResponses };
}
