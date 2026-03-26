import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingService } from '@/services/messaging.service';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export function useAttendeeNames(eventId: string) {
  return useQuery({
    queryKey: ['attendee-names', eventId],
    queryFn: () => messagingService.getAttendeeNames(eventId),
    enabled: !!eventId,
    staleTime: 10 * 60 * 1000,
  });
}

// ── Direct Chat Hooks ─────────────────────────────────────────

export function useDirectConversations(eventId: string, attendeeId: string) {
  return useQuery({
    queryKey: ['direct-conversations', eventId, attendeeId],
    queryFn: () => messagingService.getDirectConversations(eventId, attendeeId),
    enabled: !!eventId && !!attendeeId,
    refetchInterval: false,
  });
}

export function useDirectMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['direct-messages', conversationId],
    queryFn: () => messagingService.getMessages(conversationId!),
    enabled: !!conversationId,
    refetchInterval: false,
  });
}

export function useCreateDirectConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation('messaging');

  return useMutation({
    mutationFn: (params: { eventId: string; initiatorId: string; participantId: string; organizationId: string }) =>
      messagingService.createDirectConversation(params.eventId, params.initiatorId, params.participantId, params.organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });
      toast({ title: t('inviteSent') });
    },
    onError: () => {
      toast({ title: t('errorSending'), variant: 'destructive' });
    },
  });
}

export function useAcceptConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messagingService.acceptConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });
    },
  });
}

export function useRejectConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messagingService.rejectConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation('messaging');

  return useMutation({
    mutationFn: (params: { conversationId: string; attendeeId: string; isInitiator: boolean }) =>
      messagingService.deleteConversation(params.conversationId, params.attendeeId, params.isInitiator),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });
      toast({ title: t('conversationDeleted') });
    },
  });
}
