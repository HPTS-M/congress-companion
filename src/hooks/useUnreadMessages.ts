import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { messagingService } from '@/services/messaging.service';

interface UnreadMessagesResult {
  count: number;
  pendingInvites: number;
  unreadMessages: number;
  markAsSeen: () => void;
}

interface UnreadMessagesData {
  pendingInvites: number;
  unreadMessages: number;
  total: number;
}

const LEGACY_KEY_PREFIX = 'notifications_last_seen_';
const OLD_NEW_KEY_PREFIX = 'messages_last_seen_';
const SEED_GUARD_PREFIX = 'messages_seed_done_';

export function useUnreadMessages(eventId: string): UnreadMessagesResult {
  const { attendee } = useAuth();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const attendeeId = attendee?.id;

  // ── One-shot migration of the old localStorage timestamps into the server ──
  useEffect(() => {
    if (!attendeeId || !eventId || !isOnline) return;

    const guardKey = `${SEED_GUARD_PREFIX}${attendeeId}_${eventId}`;
    if (sessionStorage.getItem(guardKey)) return;

    const oldKey = `${OLD_NEW_KEY_PREFIX}${attendeeId}`;
    const legacyKey = `${LEGACY_KEY_PREFIX}${attendeeId}`;
    const stored = localStorage.getItem(oldKey) ?? localStorage.getItem(legacyKey);

    const seed = async () => {
      try {
        if (stored) {
          const parsed = new Date(stored);
          if (!isNaN(parsed.getTime())) {
            await messagingService.seedSeen(eventId, parsed);
          }
        }
        localStorage.removeItem(oldKey);
        localStorage.removeItem(legacyKey);
        sessionStorage.setItem(guardKey, '1');
        queryClient.invalidateQueries({ queryKey: ['unread-messages', eventId, attendeeId] });
      } catch {
        // Best-effort migration; ignore failures.
      }
    };
    seed();
  }, [attendeeId, eventId, isOnline, queryClient]);

  const markSeenMutation = useMutation({
    mutationFn: () => messagingService.markSeen(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-messages', eventId, attendeeId] });
    },
  });

  const markAsSeen = useCallback((): void => {
    if (!attendeeId || !eventId) return;
    markSeenMutation.mutate();
  }, [markSeenMutation, attendeeId, eventId]);

  // Realtime: invalidate the count whenever a conversation changes
  // (new invite via INSERT, new message preview via UPDATE).
  useRealtimeInvalidate({
    channelName: `unread-messages-${eventId}-${attendeeId}`,
    table: 'chat_conversations',
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    queryKeys: [['unread-messages', eventId, attendeeId]],
    enabled: !!attendeeId && !!eventId && isOnline,
  });

  const { data } = useQuery<UnreadMessagesData>({
    queryKey: ['unread-messages', eventId, attendeeId],
    queryFn: async () => {
      const counts = await messagingService.getUnreadCounts(eventId);
      return {
        pendingInvites: counts.pendingInvites,
        unreadMessages: counts.unreadMessages,
        total: counts.pendingInvites + counts.unreadMessages,
      };
    },
    enabled: !!attendeeId && !!eventId && isOnline,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: 'always',
  });

  return {
    count: data?.total ?? 0,
    pendingInvites: data?.pendingInvites ?? 0,
    unreadMessages: data?.unreadMessages ?? 0,
    markAsSeen,
  };
}
