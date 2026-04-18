import { supabase } from '@/integrations/supabase/client';

export interface SponsorLead {
  id: string;
  sponsor_id: string;
  attendee_id: string;
  event_id: string;
  note: string | null;
  created_at: string;
  contacted_at?: string | null;
}

export interface SponsorLeadWithAttendee extends SponsorLead {
  attendees: {
    full_name: string;
    email: string;
    specialty: string | null;
    institution: string | null;
    phone: string | null;
  };
}

export const sponsorLeadsService = {
  async create(sponsorId: string, attendeeId: string, eventId: string, note?: string): Promise<SponsorLead> {
    const { data, error } = await supabase
      .from('sponsor_leads')
      .insert({ sponsor_id: sponsorId, attendee_id: attendeeId, event_id: eventId, note: note || null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as SponsorLead;
  },

  async getMyLeadForSponsor(sponsorId: string, attendeeId: string): Promise<SponsorLead | null> {
    const { data, error } = await supabase
      .from('sponsor_leads')
      .select('*')
      .eq('sponsor_id', sponsorId)
      .eq('attendee_id', attendeeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as SponsorLead | null;
  },

  async getLeadsForSponsor(sponsorId: string): Promise<SponsorLeadWithAttendee[]> {
    const { data, error } = await supabase
      .from('sponsor_leads')
      .select('*, attendees(full_name, email, specialty, institution, phone)')
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as SponsorLeadWithAttendee[];
  },

  async markAsContacted(leadId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_lead_contacted' as never, { _lead_id: leadId } as never);
    if (error) throw new Error(error.message);
  },

  async getLeadsForEvent(eventId: string): Promise<(SponsorLead & { sponsors: { name: string }; attendees: { full_name: string; email: string; specialty: string | null; institution: string | null } })[]> {
    const { data, error } = await supabase
      .from('sponsor_leads')
      .select('*, sponsors(name), attendees(full_name, email, specialty, institution)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any;
  },

  async countForSponsor(sponsorId: string): Promise<number> {
    const { count, error } = await supabase
      .from('sponsor_leads')
      .select('*', { count: 'exact', head: true })
      .eq('sponsor_id', sponsorId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
};
