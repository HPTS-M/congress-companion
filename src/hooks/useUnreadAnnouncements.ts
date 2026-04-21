import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { announcementsService } from '@/services/announcements.service';

interface UnreadAnnouncementsResult {
  count: number;
  markAsSeen: () => void;
}

const LEGACY_KEY_PREFIX = 'notifications_last_seen_';
const OLD_NEW_KEY_PREFIX = 'announcements_last_seen_';
const SEED_GUARD_PREFIX = 'announcements_seed_done_';

export function useUnreadAnnouncements(eventId: string): UnreadAnnouncementsResult {
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
            await announcementsService.seedSeen(eventId, parsed);
          }
        }
        localStorage.removeItem(oldKey);
        // Note: legacy key is shared with messages — only remove when both hooks are done.
        sessionStorage.setItem(guardKey, '1');
        queryClient.invalidateQueries({ queryKey: ['unread-announcements', eventId, attendeeId] });
      } catch {
        // Best-effort migration; ignore failures.
      }
    };
    seed();
  }, [attendeeId, eventId, isOnline, queryClient]);

  const markSeenMutation = useMutation({
    mutationFn: () => announcementsService.markSeen(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-announcements', eventId, attendeeId] });
    },
  });

  const markAsSeen = useCallback((): void => {
    if (!attendeeId || !eventId) return;
    markSeenMutation.mutate();
  }, [markSeenMutation, attendeeId, eventId]);

  // Realtime: bump count immediately when a new announcement is inserted.
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
    queryFn: () => announcementsService.getUnreadCount(eventId),
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
