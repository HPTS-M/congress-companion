import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface StaffCheckinRecord {
  id: string;
  attendee_id: string;
  activity_id: string;
  checked_in_at: string | null;
  attendee_name: string;
  credential_code: string;
}

export interface StaffActivity {
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  activity_type: string | null;
}

export const adminCheckinStaffService = {
  async getActivities(eventId: string): Promise<StaffActivity[]> {
    const { data, error } = await supabase
      .from('event_activities')
      .select('id, title, scheduled_date, start_time, end_time, location, activity_type')
      .eq('event_id', eventId)
      .order('scheduled_date')
      .order('start_time');

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getCheckinsByActivity(activityId: string): Promise<StaffCheckinRecord[]> {
    const { data, error } = await supabase
      .from('attendee_checkins')
      .select('id, attendee_id, activity_id, checked_in_at, attendees!attendee_checkins_attendee_id_fkey(full_name, credential_code)')
      .eq('activity_id', activityId)
      .order('checked_in_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      attendee_id: row.attendee_id,
      activity_id: row.activity_id,
      checked_in_at: row.checked_in_at,
      attendee_name: row.attendees?.full_name ?? '',
      credential_code: row.attendees?.credential_code ?? '',
    }));
  },

  async getTotalAttendees(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .eq('registration_status', 'confirmed');

    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async manualCheckin(activityId: string, attendeeId: string): Promise<{ success: boolean; message: string; error?: string }> {
    const { data, error } = await supabase.rpc('process_checkin', {
      _activity_id: activityId,
      _attendee_id: attendeeId,
      _quiz_responses: '{}' as unknown as Json,
    });

    if (error) throw new Error(error.message);
    return data as any;
  },

  async searchAttendees(eventId: string, query: string) {
    const { data, error } = await supabase
      .from('attendees')
      .select('id, full_name, credential_code, email')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .eq('registration_status', 'confirmed')
      .or(`full_name.ilike.%${query}%,credential_code.ilike.%${query}%`)
      .order('full_name')
      .limit(20);

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  subscribeToCheckins(activityId: string, onUpdate: () => void): RealtimeChannel {
    return supabase
      .channel(`checkins-${activityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendee_checkins',
          filter: `activity_id=eq.${activityId}`,
        },
        onUpdate,
      )
      .subscribe();
  },

  unsubscribe(channel: RealtimeChannel) {
    supabase.removeChannel(channel);
  },
};
