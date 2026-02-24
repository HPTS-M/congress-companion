import { supabase } from '@/integrations/supabase/client';
import type { EventActivity, ActivityType } from '@/types';

export interface SessionFormData {
  title: string;
  activity_type: ActivityType;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string;
  speaker_name: string;
  speaker_bio: string;
  description: string;
  requires_checkin: boolean;
  capacity: number | null;
}

export const adminAgendaService = {
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

  createSession: async (eventId: string, form: SessionFormData): Promise<EventActivity> => {
    const { data, error } = await supabase
      .from('event_activities')
      .insert({
        event_id: eventId,
        title: form.title,
        activity_type: form.activity_type,
        scheduled_date: form.scheduled_date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        location: form.location || null,
        speaker_name: form.speaker_name || null,
        speaker_bio: form.speaker_bio || null,
        description: form.description || null,
        requires_checkin: form.requires_checkin,
        capacity: form.capacity,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EventActivity;
  },

  updateSession: async (sessionId: string, form: Partial<SessionFormData>): Promise<EventActivity> => {
    const update: Record<string, unknown> = {};
    if (form.title !== undefined) update.title = form.title;
    if (form.activity_type !== undefined) update.activity_type = form.activity_type;
    if (form.scheduled_date !== undefined) update.scheduled_date = form.scheduled_date;
    if (form.start_time !== undefined) update.start_time = form.start_time;
    if (form.end_time !== undefined) update.end_time = form.end_time || null;
    if (form.location !== undefined) update.location = form.location || null;
    if (form.speaker_name !== undefined) update.speaker_name = form.speaker_name || null;
    if (form.speaker_bio !== undefined) update.speaker_bio = form.speaker_bio || null;
    if (form.description !== undefined) update.description = form.description || null;
    if (form.requires_checkin !== undefined) update.requires_checkin = form.requires_checkin;
    if (form.capacity !== undefined) update.capacity = form.capacity;

    const { data, error } = await supabase
      .from('event_activities')
      .update(update)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EventActivity;
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    const { error } = await supabase
      .from('event_activities')
      .delete()
      .eq('id', sessionId);

    if (error) throw new Error(error.message);
  },

  duplicateSession: async (session: EventActivity): Promise<EventActivity> => {
    const { data, error } = await supabase
      .from('event_activities')
      .insert({
        event_id: session.event_id,
        title: `${session.title} (copia)`,
        activity_type: session.activity_type,
        scheduled_date: session.scheduled_date,
        start_time: session.start_time,
        end_time: session.end_time,
        location: session.location,
        speaker_name: session.speaker_name,
        speaker_bio: session.speaker_bio,
        description: session.description,
        requires_checkin: session.requires_checkin,
        capacity: session.capacity,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EventActivity;
  },

  duplicateDay: async (eventId: string, fromDate: string, toDate: string): Promise<number> => {
    const { data: sessions, error: fetchError } = await supabase
      .from('event_activities')
      .select('*')
      .eq('event_id', eventId)
      .eq('scheduled_date', fromDate);

    if (fetchError) throw new Error(fetchError.message);
    if (!sessions || sessions.length === 0) return 0;

    const inserts = sessions.map((s) => ({
      event_id: eventId,
      title: s.title,
      activity_type: s.activity_type,
      scheduled_date: toDate,
      start_time: s.start_time,
      end_time: s.end_time,
      location: s.location,
      speaker_name: s.speaker_name,
      speaker_bio: s.speaker_bio,
      description: s.description,
      requires_checkin: s.requires_checkin,
      capacity: s.capacity,
    }));

    const { error: insertError } = await supabase
      .from('event_activities')
      .insert(inserts);

    if (insertError) throw new Error(insertError.message);
    return inserts.length;
  },

  getInterestCounts: async (eventId: string): Promise<Map<string, number>> => {
    const { data, error } = await supabase
      .from('session_interests')
      .select('session_id')
      .eq('event_id', eventId);

    if (error) throw new Error(error.message);
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      map.set(row.session_id, (map.get(row.session_id) ?? 0) + 1);
    }
    return map;
  },

  getCheckinCounts: async (eventId: string): Promise<Map<string, number>> => {
    const { data, error } = await supabase
      .from('attendee_checkins')
      .select('activity_id, id')
      .in('activity_id', (
        await supabase
          .from('event_activities')
          .select('id')
          .eq('event_id', eventId)
      ).data?.map((a) => a.id) ?? []);

    if (error) throw new Error(error.message);
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      map.set(row.activity_id, (map.get(row.activity_id) ?? 0) + 1);
    }
    return map;
  },
};
