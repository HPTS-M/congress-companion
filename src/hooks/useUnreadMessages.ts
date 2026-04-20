import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
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

const LEGACY_KEY_PREFIX = 'notifications_last_seen_';
const NEW_KEY_PREFIX = 'messages_last_seen_';

interface UnreadMessagesData {
  pendingInvites: number;
  unreadMessages: number;
  total: number;
}

export function useUnreadMessages(eventId: string): UnreadMessagesResult {
  const { attendee } = useAuth();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const attendeeId = attendee?.id;
  const storageKey = attendeeId ? `${NEW_KEY_PREFIX}${attendeeId}` : null;
  const legacyKey = attendeeId ? `${LEGACY_KEY_PREFIX}${attendeeId}` : null;

  const getLastSeen = (): Date => {
    if (!storageKey) return new Date(0);
    const stored = localStorage.getItem(storageKey);
    if (stored) return new Date(stored);
    if (legacyKey) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) return new Date(legacy);
    }
    return new Date(0);
  };

  const markAsSeen = useCallback((): void => {
    if (!storageKey || !attendeeId || !eventId) return;
    localStorage.setItem(storageKey, new Date().toISOString());
    queryClient.invalidateQueries({ queryKey: ['unread-messages', eventId, attendeeId] });
  }, [storageKey, queryClient, eventId, attendeeId]);

  // Realtime: invalidate the count whenever a conversation changes
  // (new invite, new message preview). No polling needed.
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
      const counts = await messagingService.getUnreadCounts(eventId, attendeeId!, getLastSeen());
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
