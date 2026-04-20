import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { announcementsService } from '@/services/announcements.service';

interface UnreadAnnouncementsResult {
  count: number;
  markAsSeen: () => void;
}

const LEGACY_KEY_PREFIX = 'notifications_last_seen_';
const NEW_KEY_PREFIX = 'announcements_last_seen_';

export function useUnreadAnnouncements(eventId: string): UnreadAnnouncementsResult {
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
    queryClient.invalidateQueries({ queryKey: ['unread-announcements', eventId, attendeeId] });
  }, [storageKey, queryClient, eventId, attendeeId]);

  // Realtime: bump count immediately when a new announcement is inserted —
  // no need to poll because INSERTs invalidate this query directly.
  useRealtimeInvalidate({
    channelName: `unread-announcements-${eventId}-${attendeeId}`,
    table: 'announcements',
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    event: 'INSERT',
    queryKeys: [['unread-announcements', eventId, attendeeId]],
    enabled: !!attendeeId && !!eventId && isOnline,
  });

  const { data } = useQuery<number>({
    queryKey: ['unread-announcements', eventId, attendeeId],
    queryFn: () => announcementsService.getUnreadCount(eventId, getLastSeen()),
    enabled: !!attendeeId && !!eventId && isOnline,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: 'always',
  });

  return {
    count: data ?? 0,
    markAsSeen,
  };
}
