import { supabase } from '@/integrations/supabase/client';

export interface ServiceCatalogRow {
  id: string;
  event_id: string;
  name: string;
  service_type: string;
  description: string | null;
  location: string | null;
  valid_from: string | null;
  valid_until: string | null;
  valid_day: number | null;
  created_at: string | null;
  // computed
  total_tickets: number;
  used_tickets: number;
  cancelled_tickets: number;
}

export interface ServiceCatalogForm {
  name: string;
  service_type: string;
  description?: string;
  location?: string;
  valid_from?: string;
  valid_until?: string;
  valid_day?: number | null;
}

export interface ServiceAssignee {
  attendee_id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  status: string | null;
  scheduled_date: string | null;
  ticket_code: string | null;
  is_used: boolean | null;
}

export const adminLogisticsService = {
  async getAll(eventId: string): Promise<ServiceCatalogRow[]> {
    // Get catalog items
    const { data: catalog, error } = await supabase
      .from('service_catalog')
      .select('*')
      .eq('event_id', eventId)
      .order('service_type')
      .order('name');
    if (error) throw new Error(error.message);

    // Get ticket stats per service
    const { data: stats, error: statsErr } = await supabase
      .from('attendee_services')
      .select(`
        service_catalog_id,
        status,
        service_tickets (is_used)
      `)
      .in('service_catalog_id', (catalog ?? []).map((c) => c.id));

    if (statsErr) throw new Error(statsErr.message);

    const countsMap = new Map<string, { total: number; used: number; cancelled: number }>();
    for (const s of stats ?? []) {
      const catalogId = s.service_catalog_id;
      if (!countsMap.has(catalogId)) countsMap.set(catalogId, { total: 0, used: 0, cancelled: 0 });
      const c = countsMap.get(catalogId)!;
      c.total += 1;
      if (s.status === 'cancelled') {
        c.cancelled += 1;
      } else if (Array.isArray(s.service_tickets) && s.service_tickets.some((t: any) => t.is_used)) {
        c.used += 1;
      }
    }

    return (catalog ?? []).map((c) => {
      const counts = countsMap.get(c.id) ?? { total: 0, used: 0, cancelled: 0 };
      return {
        ...c,
        total_tickets: counts.total,
        used_tickets: counts.used,
        cancelled_tickets: counts.cancelled,
      } as ServiceCatalogRow;
    });
  },

  async create(eventId: string, form: ServiceCatalogForm): Promise<void> {
    const { error } = await supabase
      .from('service_catalog')
      .insert({ event_id: eventId, ...form });
    if (error) throw new Error(error.message);
  },

  async update(id: string, form: Partial<ServiceCatalogForm>): Promise<void> {
    const { error } = await supabase
      .from('service_catalog')
      .update(form)
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('service_catalog')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getAssignees(serviceCatalogId: string): Promise<ServiceAssignee[]> {
    const { data, error } = await supabase
      .from('attendee_services')
      .select(`
        attendee_id,
        status,
        scheduled_date,
        attendees!attendee_services_attendee_id_fkey (full_name, email, specialty),
        service_tickets (ticket_code, is_used)
      `)
      .eq('service_catalog_id', serviceCatalogId);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      attendee_id: row.attendee_id,
      full_name: row.attendees?.full_name ?? '',
      email: row.attendees?.email ?? '',
      specialty: row.attendees?.specialty ?? null,
      status: row.status,
      scheduled_date: row.scheduled_date,
      ticket_code: row.service_tickets?.[0]?.ticket_code ?? null,
      is_used: row.service_tickets?.[0]?.is_used ?? null,
    }));
  },
};
