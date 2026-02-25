import { supabase } from '@/integrations/supabase/client';

export interface Poll {
  id: string;
  event_id: string;
  session_id: string | null;
  question: string;
  poll_type: string;
  status: string;
  created_by: string | null;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string | null;
  session?: { title: string } | null;
  options?: PollOption[];
  response_count?: number;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  order_index: number;
}

export interface PollResponse {
  id: string;
  poll_id: string;
  attendee_id: string;
  option_id: string | null;
  text_response: string | null;
  created_at: string | null;
}

export interface PollWithResults extends Poll {
  options: (PollOption & { count: number; percentage: number })[];
  total_responses: number;
}

export const adminPollsService = {
  async getPolls(eventId: string): Promise<Poll[]> {
    const { data: polls, error } = await supabase
      .from('polls')
      .select('*, event_activities!polls_session_id_fkey(title)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Get response counts
    const pollIds = (polls || []).map(p => p.id);
    let responseCounts: Record<string, number> = {};

    if (pollIds.length > 0) {
      const { data: responses } = await supabase
        .from('poll_responses')
        .select('poll_id')
        .in('poll_id', pollIds);

      if (responses) {
        for (const r of responses) {
          responseCounts[r.poll_id] = (responseCounts[r.poll_id] || 0) + 1;
        }
      }
    }

    return (polls || []).map(p => ({
      ...p,
      session: p.event_activities ? { title: (p.event_activities as any).title } : null,
      response_count: responseCounts[p.id] || 0,
    }));
  },

  async createPoll(
    eventId: string,
    question: string,
    pollType: string,
    sessionId: string | null,
    opensAt: string | null,
    closesAt: string | null,
    options: string[],
    createdBy: string | null
  ): Promise<string> {
    const { data: poll, error } = await supabase
      .from('polls')
      .insert({
        event_id: eventId,
        question,
        poll_type: pollType,
        session_id: sessionId || null,
        opens_at: opensAt || null,
        closes_at: closesAt || null,
        created_by: createdBy,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    // Insert options
    if (options.length > 0) {
      const optionsData = options.map((text, idx) => ({
        poll_id: poll.id,
        option_text: text,
        order_index: idx,
      }));

      const { error: optErr } = await supabase
        .from('poll_options')
        .insert(optionsData);

      if (optErr) throw new Error(optErr.message);
    }

    return poll.id;
  },

  async updatePollStatus(pollId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('polls')
      .update({ status })
      .eq('id', pollId);

    if (error) throw new Error(error.message);
  },

  async deletePoll(pollId: string): Promise<void> {
    // Delete responses first
    await supabase.from('poll_responses').delete().eq('poll_id', pollId);
    const { error } = await supabase.from('polls').delete().eq('id', pollId);
    if (error) throw new Error(error.message);
  },

  async getPollResults(pollId: string): Promise<PollWithResults> {
    const { data: poll, error } = await supabase
      .from('polls')
      .select('*, event_activities!polls_session_id_fkey(title)')
      .eq('id', pollId)
      .single();

    if (error) throw new Error(error.message);

    const { data: options } = await supabase
      .from('poll_options')
      .select('*')
      .eq('poll_id', pollId)
      .order('order_index');

    const { data: responses } = await supabase
      .from('poll_responses')
      .select('*')
      .eq('poll_id', pollId);

    const totalResponses = responses?.length || 0;
    const optionCounts: Record<string, number> = {};
    for (const r of responses || []) {
      if (r.option_id) {
        optionCounts[r.option_id] = (optionCounts[r.option_id] || 0) + 1;
      }
    }

    const enrichedOptions = (options || []).map(o => ({
      ...o,
      count: optionCounts[o.id] || 0,
      percentage: totalResponses > 0 ? Math.round(((optionCounts[o.id] || 0) / totalResponses) * 100) : 0,
    }));

    return {
      ...poll,
      session: poll.event_activities ? { title: (poll.event_activities as any).title } : null,
      options: enrichedOptions,
      total_responses: totalResponses,
      responses: responses || [],
    } as any;
  },

  async getTextResponses(pollId: string): Promise<{ attendee_id: string; text_response: string; created_at: string }[]> {
    const { data, error } = await supabase
      .from('poll_responses')
      .select('attendee_id, text_response, created_at')
      .eq('poll_id', pollId)
      .not('text_response', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getSessions(eventId: string) {
    const { data, error } = await supabase
      .from('event_activities')
      .select('id, title, scheduled_date, start_time')
      .eq('event_id', eventId)
      .order('scheduled_date')
      .order('start_time');

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getPollsBySession(eventId: string, sessionId: string): Promise<Poll[]> {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .eq('event_id', eventId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(p => ({ ...p, session: null, response_count: 0 }));
  },

  async linkPollToSession(pollId: string, sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('polls')
      .update({ session_id: sessionId })
      .eq('id', pollId);

    if (error) throw new Error(error.message);
  },

  async getUnlinkedPolls(eventId: string): Promise<Poll[]> {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .eq('event_id', eventId)
      .is('session_id', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(p => ({ ...p, session: null, response_count: 0 }));
  },

  async bulkCreatePolls(
    eventId: string,
    polls: { question: string; pollType: string; sessionId: string | null; options: string[] }[],
    createdBy: string | null
  ): Promise<{ imported: number; errors: { row: number; error: string }[] }> {
    let imported = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < polls.length; i++) {
      try {
        await this.createPoll(
          eventId,
          polls[i].question,
          polls[i].pollType,
          polls[i].sessionId,
          null, null,
          polls[i].options,
          createdBy
        );
        imported++;
      } catch (err: any) {
        errors.push({ row: i + 2, error: err.message || 'Unknown error' });
      }
    }

    return { imported, errors };
  },
};
