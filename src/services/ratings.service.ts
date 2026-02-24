import { supabase } from '@/integrations/supabase/client';

export interface Rating {
  id: string;
  event_id: string;
  user_id: string;
  session_id: string;
  stars: number;
  comment: string | null;
  created_at: string | null;
}

export const ratingsService = {
  getUserRatings: async (eventId: string, attendeeId: string): Promise<Rating[]> => {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', attendeeId);

    if (error) throw new Error(error.message);
    return (data ?? []) as Rating[];
  },

  upsertRating: async (
    eventId: string,
    attendeeId: string,
    sessionId: string,
    stars: number,
    comment: string | null,
  ): Promise<void> => {
    // Check if rating exists
    const { data: existing } = await supabase
      .from('ratings')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', attendeeId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('ratings')
        .update({ stars, comment })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('ratings')
        .insert({ event_id: eventId, user_id: attendeeId, session_id: sessionId, stars, comment });
      if (error) throw new Error(error.message);
    }
  },
};
