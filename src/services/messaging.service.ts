import { supabase } from '@/integrations/supabase/client';
import { measure } from '@/lib/perf';
import { z } from 'zod';

export interface ReplyToPreview {
  id: string;
  sender_id: string;
  content: string;
  was_deleted: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string | null;
  delivered_at: string | null;
  reply_to_id: string | null;
  reply_to: ReplyToPreview | null;
  sender_name?: string;
}

export interface DirectConversation {
  id: string;
  event_id: string;
  initiated_by: string;
  participant_id: string;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  deleted_by_initiator: boolean;
  deleted_by_participant: boolean;
  other_name: string;
  other_id: string;
}

interface DirectConversationRow {
  id: string;
  status: string;
  initiated_by: string;
  participant_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string | null;
  other_id: string;
  other_name: string | null;
}

interface UnreadCounts {
  pendingInvites: number;
  unreadMessages: number;
}

// Loose RPC type because supabase generated types do not include our new functions.
type RpcCaller = (
  fn: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

// Defense-in-depth: cap quoted preview to 120 chars even though we trim server-side too.
const QUOTE_MAX = 120;

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
  replyToId: z.string().uuid().optional().nullable(),
});

interface RawMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string | null;
  delivered_at: string | null;
  reply_to_id: string | null;
  reply_to:
    | {
        id: string;
        sender_id: string;
        content: string;
        deleted_at: string | null;
      }
    | null;
}

export const messagingService = {
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    // Embed the quoted message via FK relation. Supabase resolves this as a
    // nested object; we then normalize it to ReplyToPreview.
    const { data, error } = await supabase
      .from('chat_messages')
      .select(
        'id, conversation_id, sender_id, content, created_at, delivered_at, reply_to_id, reply_to:reply_to_id(id, sender_id, content, deleted_at)'
      )
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as RawMessageRow[];
    return rows.map((r) => ({
      id: r.id,
      conversation_id: r.conversation_id,
      sender_id: r.sender_id,
      content: r.content,
      created_at: r.created_at,
      delivered_at: r.delivered_at,
      reply_to_id: r.reply_to_id,
      reply_to: r.reply_to
        ? {
            id: r.reply_to.id,
            sender_id: r.reply_to.sender_id,
            content: (r.reply_to.content ?? '').slice(0, QUOTE_MAX),
            was_deleted: r.reply_to.deleted_at !== null,
          }
        : null,
    }));
  },

  async markDelivered(conversationId: string, attendeeId: string): Promise<number> {
    const { data, error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
      'mark_messages_delivered',
      { _conversation_id: conversationId, _attendee_id: attendeeId }
    );
    if (error) throw new Error(error.message);
    return (data as number | null) ?? 0;
  },

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    replyToId?: string | null
  ): Promise<void> {
    const parsed = sendMessageSchema.safeParse({
      conversationId,
      senderId,
      content,
      replyToId: replyToId ?? null,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message ?? 'Invalid message');
    }

    const payload: Record<string, unknown> = {
      conversation_id: parsed.data.conversationId,
      sender_id: parsed.data.senderId,
      content: parsed.data.content,
    };
    if (parsed.data.replyToId) {
      payload.reply_to_id = parsed.data.replyToId;
    }

    const { error } = await supabase.from('chat_messages').insert(payload);
    if (error) throw new Error(error.message);
  },

  async getAttendeeNames(eventId: string): Promise<Record<string, string>> {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => Promise<{ data: { id: string; full_name: string }[] | null }>;
        };
      };
    })
      .from('public_attendee_directory')
      .select('id, full_name')
      .eq('event_id', eventId);

    const map: Record<string, string> = {};
    (data ?? []).forEach((a) => {
      map[a.id] = a.full_name;
    });
    return map;
  },

  // ── Direct Chat ─────────────────────────────────────────────
  async getDirectConversations(eventId: string, attendeeId: string): Promise<DirectConversation[]> {
    return measure('list.directConversations', async () => {
      const { data, error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
        'get_my_direct_conversations',
        { _event_id: eventId, _attendee_id: attendeeId }
      );

      if (error) throw new Error(error.message);
      const rows = (data as DirectConversationRow[] | null) ?? [];

      return rows.map((c) => ({
        id: c.id,
        event_id: eventId,
        initiated_by: c.initiated_by,
        participant_id: c.participant_id,
        status: c.status,
        last_message_at: c.last_message_at,
        last_message_preview: c.last_message_preview,
        deleted_by_initiator: false,
        deleted_by_participant: false,
        other_id: c.other_id,
        other_name: c.other_name ?? 'Asistente',
      }));
    });
  },

  /**
   * Server-side count of pending invites + unread direct messages.
   * `last_seen_at` is resolved server-side via auth.uid() — no client param.
   */
  async getUnreadCounts(eventId: string): Promise<UnreadCounts> {
    return measure('count.messages', async () => {
      const { data, error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
        'count_unread_messages',
        { _event_id: eventId }
      );

      if (error) throw new Error(error.message);
      const payload = (data as { pending_invites?: number; unread_messages?: number } | null) ?? {};
      return {
        pendingInvites: payload.pending_invites ?? 0,
        unreadMessages: payload.unread_messages ?? 0,
      };
    });
  },

  /**
   * Persist "last seen" timestamp for the current attendee on the server.
   * Survives device changes, incognito mode and cache clears.
   */
  async markSeen(eventId: string): Promise<void> {
    const { error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
      'mark_messages_seen',
      { _event_id: eventId }
    );
    if (error) throw new Error(error.message);
  },

  /**
   * One-time migration of the legacy localStorage timestamp into the server.
   * Inserts only if the attendee has no existing server record.
   */
  async seedSeen(eventId: string, lastSeen: Date): Promise<void> {
    const { error } = await (supabase as unknown as { rpc: RpcCaller }).rpc(
      'seed_messages_seen',
      { _event_id: eventId, _last_seen: lastSeen.toISOString() }
    );
    if (error) throw new Error(error.message);
  },

  async createDirectConversation(
    eventId: string,
    initiatorId: string,
    participantId: string,
    organizationId: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        event_id: eventId,
        organization_id: organizationId,
        conversation_type: 'direct',
        initiated_by: initiatorId,
        participant_id: participantId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return data.id;
  },

  async acceptConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ status: 'active' })
      .eq('id', conversationId);

    if (error) throw new Error(error.message);
  },

  async rejectConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ status: 'deleted' })
      .eq('id', conversationId);

    if (error) throw new Error(error.message);
  },

  async deleteConversation(conversationId: string, _attendeeId: string, isInitiator: boolean): Promise<void> {
    const field = isInitiator ? 'deleted_by_initiator' : 'deleted_by_participant';

    const { error } = await supabase
      .from('chat_conversations')
      .update({ [field]: true })
      .eq('id', conversationId);

    if (error) throw new Error(error.message);

    const { data } = await supabase
      .from('chat_conversations')
      .select('deleted_by_initiator, deleted_by_participant')
      .eq('id', conversationId)
      .single();

    if (data?.deleted_by_initiator && data?.deleted_by_participant) {
      await supabase
        .from('chat_conversations')
        .update({ status: 'deleted' })
        .eq('id', conversationId);
    }
  },
};
