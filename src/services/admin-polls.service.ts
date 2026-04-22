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
  updated_at?: string | null;
  results_visibility?: string;
  session?: { title: string } | null;
  options?: PollOption[];
  response_count?: number;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  order_index: number;
  is_active?: boolean;
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

    const pollIds = (polls || []).map(p => p.id);
    const responseCounts: Record<string, number> = {};

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
      session: p.event_activities ? { title: (p.event_activities as { title: string }).title } : null,
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

  /**
   * Update poll question, session and options.
   * If the poll has responses, options that are removed are kept but marked
   * is_active = false so historical counts remain valid. New options are inserted.
   */
  async updatePoll(
    pollId: string,
    data: {
      question: string;
      sessionId: string | null;
      options: { id?: string; text: string }[];
    }
  ): Promise<void> {
    const { error: upErr } = await supabase
      .from('polls')
      .update({ question: data.question, session_id: data.sessionId })
      .eq('id', pollId);
    if (upErr) throw new Error(upErr.message);

    // Existing options
    const { data: existing, error: exErr } = await supabase
      .from('poll_options')
      .select('id, option_text, order_index, is_active')
      .eq('poll_id', pollId);
    if (exErr) throw new Error(exErr.message);

    const incomingIds = new Set(data.options.filter(o => o.id).map(o => o.id!));
    const existingMap = new Map((existing ?? []).map(o => [o.id, o]));

    // Are there responses? (for safety we don't delete options with responses)
    const { data: resp, error: rErr } = await supabase
      .from('poll_responses')
      .select('option_id')
      .eq('poll_id', pollId);
    if (rErr) throw new Error(rErr.message);
    const optionsWithResponses = new Set((resp ?? []).map(r => r.option_id).filter(Boolean) as string[]);

    // Disable/delete removed options
    for (const ex of existing ?? []) {
      if (!incomingIds.has(ex.id)) {
        if (optionsWithResponses.has(ex.id)) {
          await supabase.from('poll_options').update({ is_active: false }).eq('id', ex.id);
        } else {
          await supabase.from('poll_options').delete().eq('id', ex.id);
        }
      }
    }

    // Update existing & insert new (re-activating an existing one if it was inactive)
    for (let i = 0; i < data.options.length; i++) {
      const o = data.options[i];
      if (o.id && existingMap.has(o.id)) {
        await supabase
          .from('poll_options')
          .update({ option_text: o.text, order_index: i, is_active: true })
          .eq('id', o.id);
      } else {
        await supabase
          .from('poll_options')
          .insert({ poll_id: pollId, option_text: o.text, order_index: i });
      }
    }
  },

  async getPollForEdit(pollId: string): Promise<{
    poll: Poll;
    options: PollOption[];
    response_count: number;
  }> {
    const { data: poll, error } = await supabase
      .from('polls')
      .select('*')
      .eq('id', pollId)
      .single();
    if (error) throw new Error(error.message);

    const { data: options } = await supabase
      .from('poll_options')
      .select('*')
      .eq('poll_id', pollId)
      .eq('is_active', true)
      .order('order_index');

    const { count } = await supabase
      .from('poll_responses')
      .select('id', { count: 'exact', head: true })
      .eq('poll_id', pollId);

    return {
      poll: poll as Poll,
      options: (options ?? []) as PollOption[],
      response_count: count ?? 0,
    };
  },

  /**
   * Delete a poll and all its dependencies.
   * Order matters: responses → options → poll (FK constraints).
   * Each step propagates its error with context for clear diagnostics.
   */
  async deletePoll(pollId: string): Promise<void> {
    const { error: responsesError } = await supabase
      .from('poll_responses')
      .delete()
      .eq('poll_id', pollId);
    if (responsesError) {
      throw new Error(`Failed to delete poll responses: ${responsesError.message}`);
    }

    const { error: optionsError } = await supabase
      .from('poll_options')
      .delete()
      .eq('poll_id', pollId);
    if (optionsError) {
      throw new Error(`Failed to delete poll options: ${optionsError.message}`);
    }

    const { error: pollError } = await supabase
      .from('polls')
      .delete()
      .eq('id', pollId);
    if (pollError) {
      throw new Error(`Failed to delete poll: ${pollError.message}`);
    }
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
      session: poll.event_activities ? { title: (poll.event_activities as { title: string }).title } : null,
      options: enrichedOptions,
      total_responses: totalResponses,
    } as PollWithResults;
  },

  async getTextResponses(pollId: string): Promise<{ attendee_id: string; attendee_name: string; credential_code: string; text_response: string; created_at: string }[]> {
    const { data: responses, error } = await supabase
      .from('poll_responses')
      .select('attendee_id, text_response, created_at')
      .eq('poll_id', pollId)
      .not('text_response', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const list = responses ?? [];
    if (list.length === 0) return [];

    const attendeeIds = Array.from(new Set(list.map(r => r.attendee_id)));
    const { data: attendees } = await supabase
      .from('attendees')
      .select('id, full_name, credential_code')
      .in('id', attendeeIds);

    const attMap = new Map((attendees ?? []).map(a => [a.id, a]));

    return list.map(r => {
      const a = attMap.get(r.attendee_id);
      return {
        attendee_id: r.attendee_id,
        attendee_name: a?.full_name ?? '(asistente eliminado)',
        credential_code: a?.credential_code ?? '',
        text_response: r.text_response ?? '',
        created_at: r.created_at ?? '',
      };
    });
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
      } catch (err) {
        errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return { imported, errors };
  },
};
