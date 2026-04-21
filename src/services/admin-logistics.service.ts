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
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  status: string | null; // 'scheduled' | 'cancelled'
  effective_status: string | null; // 'scheduled' | 'completed' | 'cancelled'
  cancelled_at: string | null;
  completed_at: string | null; // computed (MAX(used_at) of related tickets)
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
  starts_at?: string | null;
  ends_at?: string | null;
  // legacy fields (kept for backwards-compat with provider portal / older code)
  valid_from?: string;
  valid_until?: string;
  valid_day?: number | null;
}

export interface ServiceAssignee {
  attendee_service_id: string;
  attendee_id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  credential_code: string;
  status: string | null;
  scheduled_date: string | null;
  ticket_code: string | null;
  is_used: boolean | null;
  used_at: string | null;
}

export interface UnassignedAttendee {
  id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  credential_code: string;
}

export const adminLogisticsService = {
  async getAll(eventId: string): Promise<ServiceCatalogRow[]> {
    const { data: catalog, error } = await (supabase as any)
      .from('service_catalog_with_status')
      .select('*')
      .eq('event_id', eventId)
      .order('service_type')
      .order('name');
    if (error) throw new Error(error.message);

    const ids = (catalog ?? []).map((c: any) => c.id);
    if (ids.length === 0) return [];

    const { data: stats, error: statsErr } = await supabase
      .from('attendee_services')
      .select(`service_catalog_id, status, service_tickets (is_used, used_at)`)
      .in('service_catalog_id', ids);
    if (statsErr) throw new Error(statsErr.message);

    const countsMap = new Map<string, { total: number; used: number; cancelled: number; lastUsedAt: string | null }>();
    for (const s of stats ?? []) {
      const catalogId = s.service_catalog_id;
      if (!countsMap.has(catalogId)) countsMap.set(catalogId, { total: 0, used: 0, cancelled: 0, lastUsedAt: null });
      const c = countsMap.get(catalogId)!;
      c.total += 1;
      if (s.status === 'cancelled') {
        c.cancelled += 1;
      } else if (Array.isArray(s.service_tickets) && s.service_tickets.some((t: any) => t.is_used)) {
        c.used += 1;
        for (const t of s.service_tickets as Array<{ is_used: boolean; used_at: string | null }>) {
          if (t.is_used && t.used_at && (!c.lastUsedAt || t.used_at > c.lastUsedAt)) {
            c.lastUsedAt = t.used_at;
          }
        }
      }
    }

    return (catalog ?? []).map((c: any) => {
      const counts = countsMap.get(c.id) ?? { total: 0, used: 0, cancelled: 0, lastUsedAt: null };
      const isCompleted = c.effective_status === 'completed';
      return {
        ...c,
        starts_at: c.starts_at ?? null,
        ends_at: c.ends_at ?? null,
        total_tickets: counts.total,
        used_tickets: counts.used,
        cancelled_tickets: counts.cancelled,
        cancelled_at: c.cancelled_at ?? null,
        completed_at: isCompleted ? counts.lastUsedAt : null,
      } as ServiceCatalogRow;
    });
  },

  async cancelService(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('service_catalog')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async reactivateService(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('service_catalog')
      .update({ status: 'scheduled' })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async create(eventId: string, form: ServiceCatalogForm): Promise<void> {
    const { error } = await supabase.from('service_catalog').insert({ event_id: eventId, ...form } as any);
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_NAME');
      throw new Error(error.message);
    }
  },

  async update(id: string, form: Partial<ServiceCatalogForm>): Promise<void> {
    const { error } = await supabase.from('service_catalog').update(form as any).eq('id', id);
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_NAME');
      throw new Error(error.message);
    }
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('service_catalog').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getAssignees(serviceCatalogId: string): Promise<ServiceAssignee[]> {
    const { data, error } = await supabase
      .from('attendee_services')
      .select(`
        id, attendee_id, status, scheduled_date,
        attendees!attendee_services_attendee_id_fkey (full_name, email, specialty, credential_code),
        service_tickets (ticket_code, is_used, used_at)
      `)
      .eq('service_catalog_id', serviceCatalogId);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      attendee_service_id: row.id,
      attendee_id: row.attendee_id,
      full_name: row.attendees?.full_name ?? '',
      email: row.attendees?.email ?? '',
      specialty: row.attendees?.specialty ?? null,
      credential_code: row.attendees?.credential_code ?? '',
      status: row.status,
      scheduled_date: row.scheduled_date,
      ticket_code: row.service_tickets?.[0]?.ticket_code ?? null,
      is_used: row.service_tickets?.[0]?.is_used ?? null,
      used_at: row.service_tickets?.[0]?.used_at ?? null,
    }));
  },

  async getUnassigned(eventId: string, serviceCatalogId: string): Promise<UnassignedAttendee[]> {
    // Get already assigned attendee IDs
    const { data: assigned, error: aErr } = await supabase
      .from('attendee_services')
      .select('attendee_id')
      .eq('service_catalog_id', serviceCatalogId);
    if (aErr) throw new Error(aErr.message);
    const assignedIds = new Set((assigned ?? []).map((a) => a.attendee_id));

    // Get all event attendees
    const { data: attendees, error: atErr } = await supabase
      .from('attendees')
      .select('id, full_name, email, specialty, credential_code')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('full_name');
    if (atErr) throw new Error(atErr.message);

    return (attendees ?? []).filter((a) => !assignedIds.has(a.id)).map((a) => ({
      id: a.id,
      full_name: a.full_name,
      email: a.email,
      specialty: a.specialty,
      credential_code: a.credential_code,
    }));
  },

  async assignAttendee(serviceCatalogId: string, attendeeId: string): Promise<void> {
    const { error } = await supabase.from('attendee_services').insert({
      service_catalog_id: serviceCatalogId,
      attendee_id: attendeeId,
      status: 'pending',
    });
    if (error) throw new Error(error.message);
  },

  async unassignAttendee(attendeeServiceId: string): Promise<void> {
    // Delete tickets first
    const { error: tErr } = await supabase.from('service_tickets').delete().eq('attendee_service_id', attendeeServiceId);
    if (tErr) throw new Error(tErr.message);
    const { error } = await supabase.from('attendee_services').delete().eq('id', attendeeServiceId);
    if (error) throw new Error(error.message);
  },

  async bulkAssign(serviceCatalogId: string, attendeeIds: string[]): Promise<{ assigned: number; errors: number }> {
    let assigned = 0;
    let errors = 0;
    for (const attendeeId of attendeeIds) {
      try {
        await this.assignAttendee(serviceCatalogId, attendeeId);
        assigned++;
      } catch {
        errors++;
      }
    }
    return { assigned, errors };
  },

  async updateTicketStatus(attendeeServiceId: string, newStatus: string, note?: string): Promise<void> {
    const updates: Record<string, any> = { status: newStatus };
    if (note !== undefined) updates.notes = note;
    const { error } = await supabase.from('attendee_services').update(updates).eq('id', attendeeServiceId);
    if (error) throw new Error(error.message);

    // If marking as used, also mark the ticket
    if (newStatus === 'completed') {
      const { error: tErr } = await supabase
        .from('service_tickets')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('attendee_service_id', attendeeServiceId);
      if (tErr) throw new Error(tErr.message);
    }
  },

  async getConfirmedAttendeeIds(eventId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('registration_status', 'confirmed')
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => a.id);
  },

  async getAllAttendeeIds(eventId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('attendees')
      .select('id')
      .eq('event_id', eventId)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => a.id);
  },
};
