import { supabase } from '@/integrations/supabase/client';
import { measure } from '@/lib/perf';

export interface Announcement {
  id: string;
  event_id: string;
  title: string;
  body: string;
  reach: string | null;
  sent_at: string | null;
}

export const announcementsService = {
  async getByEvent(eventId: string): Promise<Announcement[]> {
    return measure('list.announcements', async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, event_id, title, body, reach, sent_at')
        .eq('event_id', eventId)
        .order('sent_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    });
  },

  /**
   * Server-side count of announcements newer than `lastSeen`.
   * Replaces the previous client-side filter that downloaded the entire list.
   */
  async getUnreadCount(eventId: string, lastSeen: Date): Promise<number> {
    return measure('count.announcements', async () => {
      const { data, error } = await (supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: number | null; error: { message: string } | null }>;
      }).rpc('count_unread_announcements', {
        _event_id: eventId,
        _last_seen: lastSeen.toISOString(),
      });

      if (error) throw new Error(error.message);
      return typeof data === 'number' ? data : 0;
    });
  },
};
