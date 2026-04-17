import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { useEvent } from '@/hooks/useEvent';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { pollsService } from '@/services/polls.service';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function usePolls() {
  const { event } = useEvent();
  const { attendee } = useAuth();
  const qc = useQueryClient();
  const isOnline = useOnlineStatus();
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
      toast({ title: '✅ Respuesta enviada', description: 'Tu respuesta ha sido registrada.' });
      qc.invalidateQueries({ queryKey: ['attendee-polls', eventId, attendeeId] });
    },
    onError: (error) => {
      console.error('Poll submit error:', error);
      toast({ title: 'Error al enviar respuesta', description: error.message, variant: 'destructive' });
    },
  });

  // Realtime: refetch when polls are updated (e.g. activated/closed)
  useEffect(() => {
    if (!eventId || !isOnline) return;

    const channel = supabase
      .channel(`active-polls-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'polls',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['attendee-polls', eventId, attendeeId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'polls',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['attendee-polls', eventId, attendeeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, attendeeId, qc, isOnline]);

  return {
    polls: pollsQuery.data ?? [],
    isLoading: pollsQuery.isLoading,
    submitResponse,
    refetch: pollsQuery.refetch,
  };
}

export function usePollRealtime(pollId: string | null, onUpdate: () => void) {
  const stableOnUpdate = useCallback(onUpdate, [onUpdate]);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!pollId || !isOnline) return;

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
        () => stableOnUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, stableOnUpdate, isOnline]);
}
