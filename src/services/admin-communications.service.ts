import { supabase } from '@/integrations/supabase/client';

export interface AdminAnnouncement {
  id: string;
  event_id: string;
  title: string;
  body: string;
  reach: string | null;
  sent_at: string | null;
}

export interface ChatMessageAdmin {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string | null;
  deleted_at: string | null;
}

export const adminCommunicationsService = {
  async getAnnouncements(eventId: string): Promise<AdminAnnouncement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, event_id, title, body, reach, sent_at')
      .eq('event_id', eventId)
      .order('sent_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async createAnnouncement(eventId: string, title: string, body: string, reach = 'all'): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .insert({ event_id: eventId, title, body, reach });

    if (error) throw new Error(error.message);
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  async getAttendeesCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async getTodayAnnouncementsCount(eventId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .gte('sent_at', todayStart.toISOString());

    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async getGroupChatMessages(eventId: string): Promise<ChatMessageAdmin[]> {
    // Find group conversation for this event
    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('event_id', eventId)
      .eq('conversation_type', 'group')
      .limit(1)
      .single();

    if (!conv) return [];

    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_id, content, created_at, deleted_at')
      .eq('conversation_id', conv.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) throw new Error(error.message);
  },

  async getAttendeeNames(eventId: string): Promise<Record<string, string>> {
    const { data } = await supabase
      .from('attendees')
      .select('id, full_name')
      .eq('event_id', eventId)
      .is('deleted_at', null);

    const map: Record<string, string> = {};
    (data ?? []).forEach((a) => {
      map[a.id] = a.full_name;
    });
    return map;
  },
};
