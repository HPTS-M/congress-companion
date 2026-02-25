import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useEvent } from '@/hooks/useEvent';
import { useAuth } from '@/hooks/useAuth';
import { pollsService } from '@/services/polls.service';
import { supabase } from '@/integrations/supabase/client';

export function usePolls() {
  const { event } = useEvent();
  const { attendee } = useAuth();
  const qc = useQueryClient();
  const eventId = event?.id ?? '';
  const attendeeId = attendee?.id ?? '';

  const pollsQuery = useQuery({
    queryKey: ['attendee-polls', eventId, attendeeId],
    queryFn: () => pollsService.getActivePolls(eventId, attendeeId),
    enabled: !!eventId && !!attendeeId,
    staleTime: 15_000,
  });

  const submitResponse = useMutation({
    mutationFn: (data: { pollId: string; optionId: string | null; textResponse: string | null }) =>
      pollsService.submitResponse(data.pollId, attendeeId, data.optionId, data.textResponse),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendee-polls', eventId, attendeeId] });
    },
  });

  return {
    polls: pollsQuery.data ?? [],
    isLoading: pollsQuery.isLoading,
    submitResponse,
    refetch: pollsQuery.refetch,
  };
}

export function usePollRealtime(pollId: string | null, onUpdate: () => void) {
  useEffect(() => {
    if (!pollId) return;

    const channel = supabase
      .channel(`poll-${pollId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'poll_responses',
          filter: `poll_id=eq.${pollId}`,
        },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, onUpdate]);
}
