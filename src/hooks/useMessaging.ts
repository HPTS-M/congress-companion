import { useQuery } from '@tanstack/react-query';
import { messagingService } from '@/services/messaging.service';

export function useGroupConversation(eventId: string) {
  return useQuery({
    queryKey: ['group-conversation', eventId],
    queryFn: () => messagingService.getGroupConversation(eventId),
    enabled: !!eventId,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => messagingService.getMessages(conversationId!),
    enabled: !!conversationId,
    refetchInterval: false,
  });
}

export function useAttendeeNames(eventId: string) {
  return useQuery({
    queryKey: ['attendee-names', eventId],
    queryFn: () => messagingService.getAttendeeNames(eventId),
    enabled: !!eventId,
    staleTime: 10 * 60 * 1000,
  });
}
