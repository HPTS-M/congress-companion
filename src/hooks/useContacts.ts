import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '@/services/contacts.service';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function useEventAttendees(eventId: string | undefined) {
  const isOnline = useOnlineStatus();

  useRealtimeInvalidate({
    channelName: `event-attendees-contacts-${eventId}`,
    table: 'contacts',
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    queryKeys: [['eventAttendees', eventId]],
    enabled: !!eventId && isOnline,
  });

  return useQuery({
    queryKey: ['eventAttendees', eventId],
    queryFn: () => contactsService.getEventAttendees(eventId!),
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

export function useMyContacts(attendeeId: string | undefined) {
  const isOnline = useOnlineStatus();

  useRealtimeInvalidate({
    channelName: `my-contacts-${attendeeId}`,
    table: 'contacts',
    queryKeys: [['myContacts', attendeeId]],
    enabled: !!attendeeId && isOnline,
  });

  return useQuery({
    queryKey: ['myContacts', attendeeId],
    queryFn: () => contactsService.getMyContacts(attendeeId!),
    enabled: !!attendeeId,
  });
}

export function useSendContactRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation('contacts');

  return useMutation({
    mutationFn: ({ eventId, userId, contactId }: { eventId: string; userId: string; contactId: string }) =>
      contactsService.sendRequest(eventId, userId, contactId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['myContacts'] });
      const isAutoMatch = result.action === 'auto_accepted';
      toast({ title: isAutoMatch ? t('connectedToast') : t('requestSentToast') });
    },
    onError: () => {
      toast({ title: t('errorSending'), variant: 'destructive' });
    },
  });
}

export function useCancelContactRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation('contacts');

  return useMutation({
    mutationFn: (contactRowId: string) => contactsService.cancelRequest(contactRowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myContacts'] });
      toast({ title: t('requestCancelled') });
    },
  });
}

export function useAcceptContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactRowId: string) => contactsService.acceptRequest(contactRowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myContacts'] });
    },
  });
}

export function useRejectContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactRowId: string) => contactsService.rejectRequest(contactRowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myContacts'] });
    },
  });
}

export function useAttendeeProfile(attendeeId: string | undefined) {
  return useQuery({
    queryKey: ['attendeeProfile', attendeeId],
    queryFn: () => contactsService.getAttendeeById(attendeeId!),
    enabled: !!attendeeId,
  });
}
