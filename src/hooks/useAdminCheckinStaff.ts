import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { adminCheckinStaffService } from '@/services/admin-checkin-staff.service';

export function useStaffActivities(eventId: string | undefined) {
  return useQuery({
    queryKey: ['staff-activities', eventId],
    queryFn: () => adminCheckinStaffService.getActivities(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useActivityCheckins(activityId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['activity-checkins', activityId],
    queryFn: () => adminCheckinStaffService.getCheckinsByActivity(activityId!),
    enabled: !!activityId,
    staleTime: 30 * 1000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!activityId) return;
    const channel = adminCheckinStaffService.subscribeToCheckins(activityId, () => {
      queryClient.invalidateQueries({ queryKey: ['activity-checkins', activityId] });
    });
    return () => {
      adminCheckinStaffService.unsubscribe(channel);
    };
  }, [activityId, queryClient]);

  return query;
}

export function useTotalAttendees(eventId: string | undefined) {
  return useQuery({
    queryKey: ['total-attendees', eventId],
    queryFn: () => adminCheckinStaffService.getTotalAttendees(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffManualCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, attendeeId }: { activityId: string; attendeeId: string }) =>
      adminCheckinStaffService.manualCheckin(activityId, attendeeId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activity-checkins', variables.activityId] });
    },
  });
}

export function useAttendeeSearch(eventId: string | undefined, query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ['attendee-search', eventId, debouncedQuery],
    queryFn: () => adminCheckinStaffService.searchAttendees(eventId!, debouncedQuery),
    enabled: !!eventId && debouncedQuery.length >= 2,
    staleTime: 30 * 1000,
  });
}
