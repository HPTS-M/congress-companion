import { supabase } from '@/integrations/supabase/client';

export interface DirectoryAttendee {
  id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  institution: string | null;
}

export interface ContactRow {
  id: string;
  event_id: string;
  user_id: string;
  contact_id: string;
  status: string | null;
  connected_at: string | null;
  created_at: string | null;
}

export const contactsService = {
  async getEventAttendees(eventId: string): Promise<DirectoryAttendee[]> {
    const { data, error } = await supabase
      .from('attendees')
      .select('id, full_name, email, specialty, institution')
      .eq('event_id', eventId)
      .eq('registration_status', 'confirmed')
      .is('deleted_at', null)
      .order('full_name');

    if (error) throw new Error(error.message);
    return (data ?? []) as DirectoryAttendee[];
  },

  async getMyContacts(attendeeId: string): Promise<ContactRow[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .or(`user_id.eq.${attendeeId},contact_id.eq.${attendeeId}`);

    if (error) throw new Error(error.message);
    return (data ?? []) as ContactRow[];
  },

  async sendRequest(eventId: string, userId: string, contactId: string): Promise<void> {
    const { error } = await supabase
      .from('contacts')
      .insert({ event_id: eventId, user_id: userId, contact_id: contactId, status: 'pending' });

    if (error) throw new Error(error.message);
  },

  async acceptRequest(contactRowId: string): Promise<void> {
    const { error } = await supabase
      .from('contacts')
      .update({ status: 'accepted', connected_at: new Date().toISOString() })
      .eq('id', contactRowId);

    if (error) throw new Error(error.message);
  },

  async rejectRequest(contactRowId: string): Promise<void> {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactRowId);

    if (error) throw new Error(error.message);
  },

  async getAttendeeById(attendeeId: string): Promise<DirectoryAttendee | null> {
    const { data, error } = await supabase
      .from('attendees')
      .select('id, full_name, email, specialty, institution')
      .eq('id', attendeeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as DirectoryAttendee | null;
  },
};
