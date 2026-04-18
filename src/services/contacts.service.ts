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
    // Uses public_attendee_directory view which exposes only safe fields
    // (no email/phone/document/credential). Email is no longer surfaced here for privacy.
    const { data, error } = await (supabase as any)
      .from('public_attendee_directory')
      .select('id, full_name, specialty, institution')
      .eq('event_id', eventId)
      .order('full_name');

    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Omit<DirectoryAttendee, 'email'>>).map((d) => ({
      ...d,
      email: '', // email no longer exposed via public directory
    }));
  },

  async getMyContacts(attendeeId: string): Promise<ContactRow[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .or(`user_id.eq.${attendeeId},contact_id.eq.${attendeeId}`);

    if (error) throw new Error(error.message);
    return (data ?? []) as ContactRow[];
  },

  async sendRequest(eventId: string, _userId: string, contactId: string): Promise<{ action: string; status: string }> {
    // Uses RPC accept_or_create_contact: auto-matches if reciprocal pending exists.
    const { data, error } = await (supabase as any).rpc('accept_or_create_contact', {
      _event_id: eventId,
      _target_attendee_id: contactId,
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error ?? 'Unknown error');
    return { action: data.action as string, status: data.status as string };
  },

  async cancelRequest(contactRowId: string): Promise<void> {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactRowId);

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
    // Full attendee record only readable for accepted contacts (RLS policy).
    // For non-contacts, falls back to public directory view.
    const { data: full } = await supabase
      .from('attendees')
      .select('id, full_name, email, specialty, institution')
      .eq('id', attendeeId)
      .maybeSingle();

    if (full) return full as DirectoryAttendee;

    const { data: pub, error } = await (supabase as any)
      .from('public_attendee_directory')
      .select('id, full_name, specialty, institution')
      .eq('id', attendeeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!pub) return null;
    return { ...(pub as Omit<DirectoryAttendee, 'email'>), email: '' };
  },
};
