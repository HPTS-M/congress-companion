import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface RecentCheckin {
  id: string;
  activity_id: string;
  checked_in_at: string | null;
  activity_title: string;
}

export const checkinService = {
  async getRecentCheckins(attendeeId: string): Promise<RecentCheckin[]> {
    const { data, error } = await supabase
      .from('attendee_checkins')
      .select('id, activity_id, checked_in_at, event_activities!attendee_checkins_activity_id_fkey(title)')
      .eq('attendee_id', attendeeId)
      .order('checked_in_at', { ascending: false })
      .limit(3);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      activity_id: row.activity_id,
      checked_in_at: row.checked_in_at,
      activity_title: row.event_activities?.title ?? '',
    }));
  },

  async performCheckin(activityId: string, attendeeId: string): Promise<{ success: boolean; message: string; error?: string; quiz_score?: number }> {
    const { data, error } = await supabase.rpc('process_checkin', {
      _activity_id: activityId,
      _attendee_id: attendeeId,
      _quiz_responses: '{}' as unknown as Json,
    });

    if (error) throw new Error(error.message);
    return data as any;
  },

  async getEventActivities(eventId: string) {
    const { data, error } = await supabase
      .from('event_activities')
      .select('id, title, scheduled_date, start_time, activity_type')
      .eq('event_id', eventId)
      .order('scheduled_date')
      .order('start_time');

    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
