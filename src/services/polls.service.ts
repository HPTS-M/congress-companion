import { supabase } from '@/integrations/supabase/client';

export interface AttendeePoll {
  id: string;
  question: string;
  poll_type: string;
  status: string;
  session_id: string | null;
  session?: { title: string } | null;
  options: { id: string; option_text: string; order_index: number }[];
  response_count: number;
  my_response?: { option_id: string | null; text_response: string | null } | null;
}

export interface PollResultOption {
  id: string;
  option_text: string;
  order_index: number;
  count: number;
  percentage: number;
}

export const pollsService = {
  async getActivePolls(eventId: string, attendeeId: string): Promise<AttendeePoll[]> {
    const { data: polls, error } = await supabase
      .from('polls')
      .select('*, event_activities!polls_session_id_fkey(title)')
      .eq('event_id', eventId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const pollIds = (polls || []).map(p => p.id);
    if (pollIds.length === 0) return [];

    // Get options
    const { data: allOptions } = await supabase
      .from('poll_options')
      .select('*')
      .in('poll_id', pollIds)
      .order('order_index');

    // Get response counts
    const { data: allResponses } = await supabase
      .from('poll_responses')
      .select('poll_id, option_id')
      .in('poll_id', pollIds);

    // Get my responses
    const { data: myResponses } = await supabase
      .from('poll_responses')
      .select('poll_id, option_id, text_response')
      .in('poll_id', pollIds)
      .eq('attendee_id', attendeeId);

    const optionsByPoll: Record<string, typeof allOptions> = {};
    for (const o of allOptions || []) {
      if (!optionsByPoll[o.poll_id]) optionsByPoll[o.poll_id] = [];
      optionsByPoll[o.poll_id]!.push(o);
    }

    const countByPoll: Record<string, number> = {};
    for (const r of allResponses || []) {
      countByPoll[r.poll_id] = (countByPoll[r.poll_id] || 0) + 1;
    }

    const myResponseByPoll: Record<string, { option_id: string | null; text_response: string | null }> = {};
    for (const r of myResponses || []) {
      myResponseByPoll[r.poll_id] = { option_id: r.option_id, text_response: r.text_response };
    }

    return (polls || []).map(p => ({
      id: p.id,
      question: p.question,
      poll_type: p.poll_type,
      status: p.status,
      session_id: p.session_id,
      session: p.event_activities ? { title: (p.event_activities as any).title } : null,
      options: optionsByPoll[p.id] || [],
      response_count: countByPoll[p.id] || 0,
      my_response: myResponseByPoll[p.id] || null,
    }));
  },

  async submitResponse(
    pollId: string,
    attendeeId: string,
    optionId: string | null,
    textResponse: string | null
  ): Promise<void> {
    const { error } = await supabase
      .from('poll_responses')
      .insert({
        poll_id: pollId,
        attendee_id: attendeeId,
        option_id: optionId,
        text_response: textResponse,
      });

    if (error) throw new Error(error.message);
  },

  async getPollResults(pollId: string): Promise<PollResultOption[]> {
    const { data: options } = await supabase
      .from('poll_options')
      .select('*')
      .eq('poll_id', pollId)
      .order('order_index');

    const { data: responses } = await supabase
      .from('poll_responses')
      .select('option_id')
      .eq('poll_id', pollId);

    const total = responses?.length || 0;
    const counts: Record<string, number> = {};
    for (const r of responses || []) {
      if (r.option_id) counts[r.option_id] = (counts[r.option_id] || 0) + 1;
    }

    return (options || []).map(o => ({
      ...o,
      count: counts[o.id] || 0,
      percentage: total > 0 ? Math.round(((counts[o.id] || 0) / total) * 100) : 0,
    }));
  },
};
