import { supabase } from '@/integrations/supabase/client';

export interface AttendeeNote {
  id: string;
  event_id: string;
  user_id: string;
  session_id: string | null;
  content: string | null;
  updated_at: string | null;
  session_title?: string | null;
}

export const notesService = {
  async getByEvent(eventId: string, attendeeId: string): Promise<AttendeeNote[]> {
    const { data, error } = await supabase
      .from('attendee_notes')
      .select('*, event_activities(title)')
      .eq('event_id', eventId)
      .eq('user_id', attendeeId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((note: any) => ({
      id: note.id,
      event_id: note.event_id,
      user_id: note.user_id,
      session_id: note.session_id,
      content: note.content,
      updated_at: note.updated_at,
      session_title: note.event_activities?.title ?? null,
    }));
  },

  async create(eventId: string, attendeeId: string, sessionId: string | null, content: string): Promise<AttendeeNote> {
    const { data, error } = await supabase
      .from('attendee_notes')
      .insert({
        event_id: eventId,
        user_id: attendeeId,
        session_id: sessionId,
        content,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AttendeeNote;
  },

  async update(noteId: string, content: string, sessionId: string | null): Promise<void> {
    const { error } = await supabase
      .from('attendee_notes')
      .update({
        content,
        session_id: sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (error) throw new Error(error.message);
  },

  async remove(noteId: string): Promise<void> {
    const { error } = await supabase
      .from('attendee_notes')
      .delete()
      .eq('id', noteId);

    if (error) throw new Error(error.message);
  },
};
