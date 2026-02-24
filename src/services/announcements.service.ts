import { supabase } from '@/integrations/supabase/client';

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
    const { data, error } = await supabase
      .from('announcements')
      .select('id, event_id, title, body, reach, sent_at')
      .eq('event_id', eventId)
      .order('sent_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
