import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string | null;
  sender_name?: string;
}

export const messagingService = {
  async getGroupConversation(eventId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('event_id', eventId)
      .eq('conversation_type', 'group')
      .limit(1)
      .single();

    if (error) return null;
    return data?.id ?? null;
  },

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
};
