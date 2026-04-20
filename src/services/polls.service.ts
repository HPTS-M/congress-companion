import { supabase } from '@/integrations/supabase/client';
import { measure } from '@/lib/perf';

export interface AttendeePoll {
  id: string;
  question: string;
  poll_type: string;
  status: string;
  session_id: string | null;
  session?: { title: string } | null;
  options: { id: string; option_text: string; order_index: number }[];
  response_count: number;
  my_response?: { option_ids: string[]; text_response: string | null } | null;
}

export interface PollResultOption {
  id: string;
  option_text: string;
  order_index: number;
  count: number;
  percentage: number;
}

type RpcCaller = (
  fn: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

export const pollsService = {
  async getActivePolls(eventId: string, attendeeId: string): Promise<AttendeePoll[]> {
    return measure('list.polls', async () => {
      const { data, error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
        'get_active_polls_with_counts',
        { _event_id: eventId, _attendee_id: attendeeId }
      );

      if (error) throw new Error(error.message);
      const rows = (data as AttendeePoll[] | null) ?? [];
      return rows.map((p) => ({
        ...p,
        options: p.options ?? [],
        response_count: p.response_count ?? 0,
        my_response: p.my_response ?? null,
      }));
    });
  },

  async submitResponse(
    pollId: string,
    attendeeId: string,
    optionIds: string[] | null,
    textResponse: string | null
  ): Promise<void> {
    // Validar voto duplicado a nivel app
    const { data: existing } = await supabase
      .from('poll_responses')
      .select('id')
      .eq('poll_id', pollId)
      .eq('attendee_id', attendeeId)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error('DUPLICATE_VOTE');
    }

    if (optionIds && optionIds.length > 0) {
      const rows = optionIds.map(optionId => ({
        poll_id: pollId,
        attendee_id: attendeeId,
        option_id: optionId,
        text_response: null,
      }));
      const { error } = await supabase.from('poll_responses').insert(rows);
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error('DUPLICATE_VOTE');
        }
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabase.from('poll_responses').insert({
        poll_id: pollId,
        attendee_id: attendeeId,
        option_id: null,
        text_response: textResponse,
      });
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error('DUPLICATE_VOTE');
        }
        throw new Error(error.message);
      }
    }
  },

  async getPollResults(pollId: string): Promise<PollResultOption[]> {
    const [{ data: options }, { data: responses }] = await Promise.all([
      supabase.from('poll_options').select('*').eq('poll_id', pollId).order('order_index'),
      supabase.from('poll_responses').select('option_id').eq('poll_id', pollId),
    ]);

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
