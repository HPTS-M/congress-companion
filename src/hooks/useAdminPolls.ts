import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEvent } from '@/hooks/useEvent';
import { useAuth } from '@/hooks/useAuth';
import { adminPollsService } from '@/services/admin-polls.service';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export function useAdminPolls() {
  const { event } = useEvent();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const eventId = event?.id ?? '';

  const pollsQuery = useQuery({
    queryKey: ['admin-polls', eventId],
    queryFn: () => adminPollsService.getPolls(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
  });

  const sessionsQuery = useQuery({
    queryKey: ['admin-poll-sessions', eventId],
    queryFn: () => adminPollsService.getSessions(eventId),
    enabled: !!eventId,
    staleTime: 5 * 60_000,
  });

  const createPoll = useMutation({
    mutationFn: (data: {
      question: string;
      pollType: string;
      sessionId: string | null;
      opensAt: string | null;
      closesAt: string | null;
      options: string[];
    }) =>
      adminPollsService.createPoll(
        eventId, data.question, data.pollType,
        data.sessionId, data.opensAt, data.closesAt,
        data.options, user?.id ?? null
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-polls', eventId] });
      toast({ title: t('polls.createSuccess') });
    },
    onError: () => toast({ title: t('polls.createError'), variant: 'destructive' }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ pollId, status }: { pollId: string; status: string }) =>
      adminPollsService.updatePollStatus(pollId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-polls', eventId] });
    },
  });

  const deletePoll = useMutation({
    mutationFn: (pollId: string) => adminPollsService.deletePoll(pollId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-polls', eventId] });
      toast({ title: t('polls.deleteSuccess') });
    },
    onError: () => toast({ title: t('polls.deleteError'), variant: 'destructive' }),
  });

  return {
    polls: pollsQuery.data ?? [],
    isLoading: pollsQuery.isLoading,
    sessions: sessionsQuery.data ?? [],
    createPoll,
    updateStatus,
    deletePoll,
  };
}

export function useAdminPollResults(pollId: string | null) {
  return useQuery({
    queryKey: ['admin-poll-results', pollId],
    queryFn: () => adminPollsService.getPollResults(pollId!),
    enabled: !!pollId,
    staleTime: 10_000,
  });
}
