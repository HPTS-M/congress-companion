import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
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
    // Fallback (read-only) to legacy unified key on first run
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

  const { data } = useQuery<number>({
    queryKey: ['unread-announcements', eventId, attendeeId],
    queryFn: async () => {
      const lastSeen = getLastSeen();
      const announcements = await announcementsService.getByEvent(eventId);
      return announcements.filter(
        (a) => a.sent_at && new Date(a.sent_at) > lastSeen
      ).length;
    },
    enabled: !!attendeeId && !!eventId && isOnline,
    refetchInterval: isOnline ? 30_000 : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: 'always',
  });

  return {
    count: data ?? 0,
    markAsSeen,
  };
}
