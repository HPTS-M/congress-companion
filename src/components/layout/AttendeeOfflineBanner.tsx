import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, WifiOff, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEvent } from '@/hooks/useEvent';

type Status = 'online' | 'offline' | 'reconnecting' | 'synced';

/**
 * Attendee-only offline banner.
 * - Offline: red, persistent, can't be dismissed.
 * - Reconnecting: amber w/ spinner while we force-refresh queries + realtime.
 * - Synced: green for 1.5s, then hides.
 *
 * On reconnect we ONLY invalidate queries scoped to the current event to
 * avoid a network spike (previously we invalidated every cached event).
 */
export function AttendeeOfflineBanner() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { event } = useEvent();
  const eventId = event?.id;
  const [status, setStatus] = useState<Status>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let syncTimer: ReturnType<typeof setTimeout> | undefined;

    const handleOnline = async () => {
      setStatus('reconnecting');

      // Surgical invalidation: only refresh queries whose key includes
      // the current eventId. This prevents revalidating every event the
      // browser has cached in memory after a long offline window.
      const matchesCurrentEvent = (key: readonly unknown[]): boolean =>
        eventId ? key.some((part) => part === eventId) : true;

      await qc.invalidateQueries({
        predicate: (query) => {
          const [name] = query.queryKey as [string, ...unknown[]];
          const liveKeys = new Set([
            'unread-messages',
            'unread-announcements',
            'announcements',
            'direct-conversations',
            'direct-messages',
            'attendee-polls',
            'myContacts',
          ]);
          if (!liveKeys.has(name)) return false;
          return matchesCurrentEvent(query.queryKey);
        },
      });

      // Notify the rest of the app that we just reconnected, so realtime
      // subscriptions (DirectChatView, usePolls, etc.) can re-bind.
      window.dispatchEvent(new CustomEvent('attendee:reconnected'));

      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        setStatus('synced');
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setStatus('online'), 1500);
      }, 600);
    };

    const handleOffline = () => {
      if (hideTimer) clearTimeout(hideTimer);
      if (syncTimer) clearTimeout(syncTimer);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (hideTimer) clearTimeout(hideTimer);
      if (syncTimer) clearTimeout(syncTimer);
    };
  }, [qc, eventId]);

  if (status === 'online') return null;

  const config = {
    offline: {
      bg: 'bg-destructive text-destructive-foreground',
      icon: <WifiOff className="h-3.5 w-3.5" />,
      label: t('offlineBanner.offline'),
    },
    reconnecting: {
      bg: 'bg-amber-500 text-white',
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: t('offlineBanner.syncingTitle'),
    },
    synced: {
      bg: 'bg-emerald-500 text-white',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: t('offlineBanner.reconnected'),
    },
  }[status];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed left-0 right-0 z-40 flex items-center justify-center gap-2 py-1.5 text-[13px] font-medium transition-colors',
        'top-14 md:top-16',
        config.bg
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}
