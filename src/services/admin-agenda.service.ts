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
  speaker_photo_url?: string | null;
  status?: string | null;
}

export const adminAgendaService = {
  getActivities: async (eventId: string): Promise<EventActivity[]> => {
    const { data, error } = await supabase
      .from('event_activities')
      .select('*')
      .eq('event_id', eventId)
      .is('archived_at', null)
      .order('scheduled_date')
      .order('sort_order')
      .order('start_time');

    if (error) throw new Error(error.message);
    return (data ?? []) as EventActivity[];
  },

  getArchivedActivities: async (eventId: string): Promise<EventActivity[]> => {
    const { data, error } = await supabase
      .from('event_activities')
      .select('*')
      .eq('event_id', eventId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });

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
        speaker_photo_url: form.speaker_photo_url || null,
        status: form.status ?? null,
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
    if (form.speaker_photo_url !== undefined) update.speaker_photo_url = form.speaker_photo_url || null;
    if (form.status !== undefined) update.status = form.status ?? null;

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

  archiveSession: async (sessionId: string): Promise<void> => {
    const { error } = await supabase
      .from('event_activities')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) throw new Error(error.message);
  },

  restoreSession: async (sessionId: string): Promise<void> => {
    const { error } = await supabase
      .from('event_activities')
      .update({ archived_at: null })
      .eq('id', sessionId);
    if (error) throw new Error(error.message);
  },

  reorderSessions: async (
    updates: { id: string; sort_order: number; start_time?: string; location?: string }[],
  ): Promise<void> => {
    // Apply updates in parallel
    const results = await Promise.all(
      updates.map((u) => {
        const patch: Record<string, unknown> = { sort_order: u.sort_order };
        if (u.start_time !== undefined) patch.start_time = u.start_time;
        if (u.location !== undefined) patch.location = u.location;
        return supabase.from('event_activities').update(patch).eq('id', u.id);
      }),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) throw new Error(err.message);
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
        speaker_photo_url: session.speaker_photo_url ?? null,
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
      .is('archived_at', null)
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

  uploadSpeakerPhoto: async (eventId: string, file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('speaker-photos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(error.message);
    return path;
  },

  getSpeakerPhotoUrl: async (path: string): Promise<string | null> => {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from('speaker-photos')
      .createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  },

  deleteSpeakerPhoto: async (path: string): Promise<void> => {
    if (!path) return;
    await supabase.storage.from('speaker-photos').remove([path]);
  },
};
