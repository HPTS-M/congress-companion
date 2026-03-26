import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string | null;
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

export const messagingService = {
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async sendMessage(conversationId: string, senderId: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
      });

    if (error) throw new Error(error.message);
  },

  async getAttendeeNames(eventId: string): Promise<Record<string, string>> {
    const { data } = await supabase
      .from('attendees')
      .select('id, full_name')
      .eq('event_id', eventId)
      .is('deleted_at', null);

    const map: Record<string, string> = {};
    (data ?? []).forEach((a: any) => {
      map[a.id] = a.full_name;
    });
    return map;
  },

  // ── Direct Chat ─────────────────────────────────────────────
  async getDirectConversations(eventId: string, attendeeId: string): Promise<DirectConversation[]> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, event_id, initiated_by, participant_id, status, last_message_at, last_message_preview, deleted_by_initiator, deleted_by_participant')
      .eq('event_id', eventId)
      .eq('conversation_type', 'direct')
      .neq('status', 'deleted')
      .or(`initiated_by.eq.${attendeeId},participant_id.eq.${attendeeId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);

    // Filter out convos soft-deleted by this user
    const filtered = (data ?? []).filter((c: any) => {
      const isInitiator = c.initiated_by === attendeeId;
      if (isInitiator && c.deleted_by_initiator) return false;
      if (!isInitiator && c.deleted_by_participant) return false;
      return true;
    });

    // Collect other-side attendee IDs to resolve names
    const otherIds = filtered.map((c: any) =>
      c.initiated_by === attendeeId ? c.participant_id : c.initiated_by
    );
    const uniqueIds = [...new Set(otherIds)];

    let nameMap: Record<string, string> = {};
    if (uniqueIds.length > 0) {
      const { data: attendees } = await supabase
        .from('attendees')
        .select('id, full_name')
        .in('id', uniqueIds);
      (attendees ?? []).forEach((a: any) => {
        nameMap[a.id] = a.full_name;
      });
    }

    return filtered.map((c: any) => {
      const otherId = c.initiated_by === attendeeId ? c.participant_id : c.initiated_by;
      return {
        ...c,
        other_name: nameMap[otherId] || 'Asistente',
        other_id: otherId,
      } as DirectConversation;
    });
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

  async deleteConversation(conversationId: string, attendeeId: string, isInitiator: boolean): Promise<void> {
    const field = isInitiator ? 'deleted_by_initiator' : 'deleted_by_participant';

    // First set the flag
    const { error } = await supabase
      .from('chat_conversations')
      .update({ [field]: true })
      .eq('id', conversationId);

    if (error) throw new Error(error.message);

    // Check if both deleted, then mark as deleted
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
