import { supabase } from '@/integrations/supabase/client';

export interface TicketServiceItem {
  id: string;
  status: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
  service_catalog: {
    id: string;
    name: string;
    description: string | null;
    service_type: string;
    valid_from: string | null;
    valid_until: string | null;
    location: string | null;
  } | null;
  service_tickets: {
    id: string;
    ticket_code: string;
    qr_data: string;
    is_used: boolean | null;
    used_at: string | null;
  }[];
}

export const ticketsService = {
  getByAttendee: async (attendeeId: string): Promise<TicketServiceItem[]> => {
    const { data, error } = await supabase
      .from('attendee_services')
      .select(`
        id, status, scheduled_date, scheduled_time, notes,
        service_catalog:service_catalog_id (id, name, description, service_type, valid_from, valid_until, location),
        service_tickets (id, ticket_code, qr_data, is_used, used_at)
      `)
      .eq('attendee_id', attendeeId);

    if (error) throw new Error(error.message);
    return (data as unknown as TicketServiceItem[]) ?? [];
  },
};
