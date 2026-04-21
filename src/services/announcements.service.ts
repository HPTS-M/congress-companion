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

// Loose RPC type — generated supabase types do not include our new functions yet.
type RpcCaller = (
  fn: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

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
   * Server-side count of announcements newer than the attendee's stored
   * `last_seen_at` (resolved internally via auth.uid()).
   */
  async getUnreadCount(eventId: string): Promise<number> {
    return measure('count.announcements', async () => {
      const { data, error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
        'count_unread_announcements',
        { _event_id: eventId }
      );

      if (error) throw new Error(error.message);
      return typeof data === 'number' ? data : 0;
    });
  },

  /**
   * Persist "last seen" timestamp for the current attendee on the server.
   * Survives device changes, incognito mode and cache clears.
   */
  async markSeen(eventId: string): Promise<void> {
    const { error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
      'mark_announcements_seen',
      { _event_id: eventId }
    );
    if (error) throw new Error(error.message);
  },

  /**
   * One-time migration of the legacy localStorage timestamp into the server.
   * Inserts only if the attendee has no existing server record.
   */
  async seedSeen(eventId: string, lastSeen: Date): Promise<void> {
    const { error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
      'seed_announcements_seen',
      { _event_id: eventId, _last_seen: lastSeen.toISOString() }
    );
    if (error) throw new Error(error.message);
  },
};
