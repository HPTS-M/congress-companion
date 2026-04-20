import { useEffect, useState } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeInvalidateOptions {
  channelName: string;
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  queryKeys: QueryKey[];
  enabled?: boolean;
}

/**
 * Subscribe to Supabase Realtime postgres_changes and invalidate TanStack Query keys.
 * - Auto-resubscribes on `attendee:reconnected` window event.
 * - Cleans up channel on unmount/dep change (project rule).
 * - Caller should gate `enabled` with useOnlineStatus() to avoid offline channels.
 */
export function useRealtimeInvalidate({
  channelName,
  table,
  filter,
  event = '*',
  queryKeys,
  enabled = true,
}: UseRealtimeInvalidateOptions): void {
  const qc = useQueryClient();
  const [reconnectKey, setReconnectKey] = useState(0);

  // Re-subscribe after reconnect
  useEffect(() => {
    const onReconnect = (): void => setReconnectKey((k) => k + 1);
    window.addEventListener('attendee:reconnected', onReconnect);
    return () => window.removeEventListener('attendee:reconnected', onReconnect);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`${channelName}-${reconnectKey}`)
      .on(
        // @ts-expect-error - postgres_changes has loose typing in supabase-js
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          for (const key of queryKeys) {
            qc.invalidateQueries({ queryKey: key });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter, event, enabled, reconnectKey, qc]);
}
