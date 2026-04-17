import { supabase } from '@/integrations/supabase/client';
import type { EventActivity, SessionInterest } from '@/types';

export const agendaService = {
  getActivities: async (eventId: string): Promise<EventActivity[]> => {
    const { data, error } = await supabase
      .from('event_activities')
      .select('*')
      .eq('event_id', eventId)
      .order('scheduled_date')
      .order('start_time');

    if (error) throw new Error(error.message);
    return (data ?? []) as EventActivity[];
  },

  // Returns aggregated interest counts per session (no PII).
  // Uses SECURITY DEFINER RPC because RLS now restricts session_interests SELECT to own rows.
  getInterestCounts: async (eventId: string): Promise<Map<string, number>> => {
    const { data, error } = await supabase.rpc('get_session_interest_counts', { _event_id: eventId });
    if (error) throw new Error(error.message);
    const map = new Map<string, number>();
    for (const row of (data ?? []) as { session_id: string; interest_count: number }[]) {
      map.set(row.session_id, Number(row.interest_count));
    }
    return map;
  },

  getUserInterests: async (eventId: string, attendeeId: string): Promise<SessionInterest[]> => {
    const { data, error } = await supabase
      .from('session_interests')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', attendeeId);

    if (error) throw new Error(error.message);
    return (data ?? []) as SessionInterest[];
  },

  toggleInterest: async (
    eventId: string,
    sessionId: string,
    attendeeId: string,
    isCurrentlyInterested: boolean,
  ): Promise<void> => {
    if (isCurrentlyInterested) {
      const { error } = await supabase
        .from('session_interests')
        .delete()
        .eq('event_id', eventId)
        .eq('session_id', sessionId)
        .eq('user_id', attendeeId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('session_interests')
        .insert({ event_id: eventId, session_id: sessionId, user_id: attendeeId });
      if (error) throw new Error(error.message);
    }
  },

  getUserCheckins: async (attendeeId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('attendee_checkins')
      .select('activity_id')
      .eq('attendee_id', attendeeId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.activity_id);
  },
};
