import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type AttendeeRow = Tables<'attendees'>;

export interface AttendeeWithServices extends AttendeeRow {
  servicesCount: number;
}

export interface CreateAttendeeData {
  event_id: string;
  full_name: string;
  email: string;
  specialty?: string;
  institution?: string;
  registration_status?: string;
  external_credential_code?: string | null;
}

export interface BulkAttendeeRow {
  full_name: string;
  email: string;
  specialty?: string;
  institution?: string;
  external_credential_code?: string | null;
  registration_status?: string;
}

export interface AttendeeCounts {
  total: number;
  confirmed: number;
  pending: number;
}

export interface ExportRow {
  full_name: string;
  email: string;
  credential_code: string;
  specialty: string;
  institution: string;
  registration_status: string;
  services_count: number;
  checkins_count: number;
}

export interface DataQualityResult {
  noEmail: string[];
  duplicateCodes: string[];
  duplicateEmails: string[];
  noSpecialty: string[];
}

export interface AddServiceData {
  name: string;
  service_type: string;
  scheduled_date?: string;
  valid_from?: string;
  valid_until?: string;
  description?: string;
}

export interface AttendeeFilters {
  specialties?: string[];
  institutions?: string[];
  hasServices?: 'yes' | 'no' | null;
}

export const adminAttendeesService = {
  getAttendees: async (
    eventId: string,
    search?: string,
    statusFilter?: string,
    filters?: AttendeeFilters,
  ): Promise<AttendeeWithServices[]> => {
    let query = supabase
      .from('attendees')
      .select(
        'id, event_id, full_name, email, credential_code, registration_status, specialty, institution, phone, registration_date, invitation_sent_at, created_at, user_id',
      )
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('registration_status', statusFilter);
    }

    if (filters?.specialties?.length) {
      query = query.in('specialty', filters.specialties);
    }
    if (filters?.institutions?.length) {
      query = query.in('institution', filters.institutions);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,credential_code.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const attendeeIds = (data ?? []).map((a) => a.id);
    let servicesCounts: Record<string, number> = {};

    if (attendeeIds.length > 0) {
      // Single batch query — replaces N+1 pattern
      const { data: services } = await supabase
        .from('attendee_services')
        .select('attendee_id')
        .in('attendee_id', attendeeIds);

      if (services) {
        servicesCounts = services.reduce(
          (acc, s) => {
            acc[s.attendee_id] = (acc[s.attendee_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
      }
    }

    let result = (data ?? []).map((a) => ({
      ...(a as AttendeeRow),
      servicesCount: servicesCounts[a.id] ?? 0,
    }));

    // Apply hasServices filter post-aggregation (cheap: already in memory)
    if (filters?.hasServices === 'yes') {
      result = result.filter((a) => a.servicesCount > 0);
    } else if (filters?.hasServices === 'no') {
      result = result.filter((a) => a.servicesCount === 0);
    }

    return result;
  },

  /** Distinct specialties + institutions for filter dropdowns. */
  getFilterOptions: async (
    eventId: string,
  ): Promise<{ specialties: string[]; institutions: string[] }> => {
    const { data, error } = await supabase
      .from('attendees')
      .select('specialty, institution')
      .eq('event_id', eventId)
      .is('deleted_at', null);

    if (error) throw new Error(error.message);

    const specialties = new Set<string>();
    const institutions = new Set<string>();
    (data ?? []).forEach((row) => {
      if (row.specialty?.trim()) specialties.add(row.specialty.trim());
      if (row.institution?.trim()) institutions.add(row.institution.trim());
    });

    return {
      specialties: [...specialties].sort((a, b) => a.localeCompare(b)),
      institutions: [...institutions].sort((a, b) => a.localeCompare(b)),
    };
  },

  getCounts: async (eventId: string): Promise<AttendeeCounts> => {
    const [totalRes, confirmedRes, pendingRes] = await Promise.all([
      supabase
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('deleted_at', null),
      supabase
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('registration_status', 'confirmed')
        .is('deleted_at', null),
      supabase
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('registration_status', 'pending')
        .is('deleted_at', null),
    ]);

    return {
      total: totalRes.count ?? 0,
      confirmed: confirmedRes.count ?? 0,
      pending: pendingRes.count ?? 0,
    };
  },

  createAttendee: async (data: CreateAttendeeData): Promise<AttendeeRow> => {
    const { data: attendee, error } = await supabase
      .from('attendees')
      .insert({
        event_id: data.event_id,
        full_name: data.full_name,
        email: data.email,
        specialty: data.specialty || null,
        institution: data.institution || null,
        registration_status: data.registration_status || 'confirmed',
        credential_code: '',
        external_credential_code: data.external_credential_code || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return attendee;
  },

  bulkCreateAttendees: async (
    eventId: string,
    rows: BulkAttendeeRow[],
    registrationStatus: string = 'confirmed',
  ): Promise<{ inserted: number; errors: number; ids: string[] }> => {
    const inserts = rows.map((r) => ({
      event_id: eventId,
      full_name: r.full_name,
      email: r.email,
      specialty: r.specialty || null,
      institution: r.institution || null,
      registration_status: r.registration_status || registrationStatus,
      credential_code: '',
      external_credential_code: r.external_credential_code || null,
    }));

    const { data, error } = await supabase.from('attendees').insert(inserts).select('id');

    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((d) => d.id);
    return { inserted: ids.length, errors: rows.length - ids.length, ids };
  },

  updateAttendee: async (
    attendeeId: string,
    data: Partial<Pick<AttendeeRow, 'full_name' | 'email' | 'specialty' | 'institution' | 'registration_status' | 'external_credential_code'>>,
  ): Promise<AttendeeRow> => {
    const { data: attendee, error } = await supabase
      .from('attendees')
      .update(data)
      .eq('id', attendeeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return attendee;
  },

  updateAttendee: async (
    attendeeId: string,
    data: Partial<Pick<AttendeeRow, 'full_name' | 'email' | 'specialty' | 'institution' | 'registration_status'>>,
  ): Promise<AttendeeRow> => {
    const { data: attendee, error } = await supabase
      .from('attendees')
      .update(data)
      .eq('id', attendeeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return attendee;
  },

  updateAttendeeStatus: async (attendeeId: string, status: string): Promise<void> => {
    const { error } = await supabase
      .from('attendees')
      .update({ registration_status: status })
      .eq('id', attendeeId);
    if (error) throw new Error(error.message);
  },

  deleteAttendee: async (attendeeId: string): Promise<void> => {
    const { error } = await supabase
      .from('attendees')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', attendeeId);

    if (error) throw new Error(error.message);
  },

  getAttendeeDetail: async (attendeeId: string) => {
    const [attendeeRes, servicesRes, checkinsRes] = await Promise.all([
      supabase.from('attendees').select('*').eq('id', attendeeId).single(),
      supabase
        .from('attendee_services')
        .select('*, service_catalog:service_catalog_id(name, service_type, description)')
        .eq('attendee_id', attendeeId)
        .order('scheduled_date', { ascending: true }),
      supabase
        .from('attendee_checkins')
        .select('*, event_activities:activity_id(title, scheduled_date)')
        .eq('attendee_id', attendeeId)
        .order('checked_in_at', { ascending: false }),
    ]);

    if (attendeeRes.error) throw new Error(attendeeRes.error.message);

    return {
      attendee: attendeeRes.data,
      services: servicesRes.data ?? [],
      checkins: checkinsRes.data ?? [],
    };
  },

  regenerateCode: async (attendeeId: string): Promise<string> => {
    const { data, error } = await supabase.rpc('create_attendee_credential', {
      _attendee_id: attendeeId,
    });
    if (error) throw new Error(error.message);
    return data as string;
  },

  regenerateAccessCode: async (
    attendeeId: string,
    sendEmail: boolean = false,
  ): Promise<{ access_code: string; email_sent: boolean }> => {
    const { data, error } = await supabase.functions.invoke('regenerate-access-code', {
      body: { attendee_id: attendeeId, send_email: sendEmail },
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; access_code: string; email_sent: boolean; error?: string };
    if (!result?.success) throw new Error(result?.error ?? 'Failed to regenerate access code');
    return { access_code: result.access_code, email_sent: result.email_sent };
  },

  // --- Service management ---

  addServiceToAttendee: async (
    attendeeId: string,
    eventId: string,
    data: AddServiceData,
  ): Promise<void> => {
    // Guard: block adding services to deactivated (cancelled) attendees
    const { data: attendee, error: aErr } = await supabase
      .from('attendees')
      .select('registration_status')
      .eq('id', attendeeId)
      .single();
    if (aErr) throw new Error(aErr.message);
    if (attendee?.registration_status === 'cancelled') {
      throw new Error('ATTENDEE_DEACTIVATED');
    }

    const { data: catalog, error: catError } = await supabase
      .from('service_catalog')
      .insert({
        event_id: eventId,
        name: data.name,
        service_type: data.service_type,
        description: data.description || null,
        valid_from: data.valid_from || null,
        valid_until: data.valid_until || null,
      })
      .select()
      .single();

    if (catError) throw new Error(catError.message);

    const { error: serviceError } = await supabase
      .from('attendee_services')
      .insert({
        attendee_id: attendeeId,
        service_catalog_id: catalog.id,
        scheduled_date: data.scheduled_date || null,
        status: 'scheduled',
      });

    if (serviceError) throw new Error(serviceError.message);
  },

  updateServiceStatus: async (serviceId: string, status: string): Promise<void> => {
    const { error } = await supabase
      .from('attendee_services')
      .update({ status })
      .eq('id', serviceId);
    if (error) throw new Error(error.message);
  },

  deleteService: async (serviceId: string): Promise<void> => {
    await supabase.from('service_tickets').delete().eq('attendee_service_id', serviceId);
    const { error } = await supabase.from('attendee_services').delete().eq('id', serviceId);
    if (error) throw new Error(error.message);
  },

  // --- Export ---

  getExportData: async (eventId: string): Promise<ExportRow[]> => {
    const { data: attendees, error } = await supabase
      .from('attendees')
      .select('id, full_name, email, credential_code, specialty, institution, registration_status')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('full_name');

    if (error) throw new Error(error.message);
    if (!attendees?.length) return [];

    const ids = attendees.map((a) => a.id);

    const [servicesRes, checkinsRes] = await Promise.all([
      supabase.from('attendee_services').select('attendee_id').in('attendee_id', ids),
      supabase.from('attendee_checkins').select('attendee_id').in('attendee_id', ids),
    ]);

    const serviceCounts: Record<string, number> = {};
    (servicesRes.data ?? []).forEach((s) => {
      serviceCounts[s.attendee_id] = (serviceCounts[s.attendee_id] || 0) + 1;
    });

    const checkinCounts: Record<string, number> = {};
    (checkinsRes.data ?? []).forEach((c) => {
      checkinCounts[c.attendee_id] = (checkinCounts[c.attendee_id] || 0) + 1;
    });

    return attendees.map((a) => ({
      full_name: a.full_name,
      email: a.email,
      credential_code: a.credential_code,
      specialty: a.specialty || '',
      institution: a.institution || '',
      registration_status: a.registration_status || '',
      services_count: serviceCounts[a.id] || 0,
      checkins_count: checkinCounts[a.id] || 0,
    }));
  },

  // --- Data quality ---

  getDataQuality: async (eventId: string): Promise<DataQualityResult> => {
    const { data, error } = await supabase
      .from('attendees')
      .select('id, email, credential_code, specialty')
      .eq('event_id', eventId)
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    const attendees = data ?? [];

    const noEmail = attendees.filter((a) => !a.email?.trim()).map((a) => a.id);
    const noSpecialty = attendees.filter((a) => !a.specialty?.trim()).map((a) => a.id);

    const codeCounts = new Map<string, string[]>();
    attendees.forEach((a) => {
      const ids = codeCounts.get(a.credential_code) || [];
      ids.push(a.id);
      codeCounts.set(a.credential_code, ids);
    });
    const duplicateCodes = [...codeCounts.values()].filter((v) => v.length > 1).flat();

    const emailCounts = new Map<string, string[]>();
    attendees.forEach((a) => {
      if (!a.email) return;
      const key = a.email.toLowerCase();
      const ids = emailCounts.get(key) || [];
      ids.push(a.id);
      emailCounts.set(key, ids);
    });
    const duplicateEmails = [...emailCounts.values()].filter((v) => v.length > 1).flat();

    return { noEmail, duplicateCodes, duplicateEmails, noSpecialty };
  },

  getExistingEmails: async (eventId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('attendees')
      .select('email')
      .eq('event_id', eventId)
      .is('deleted_at', null);
    return (data ?? []).map((a) => a.email.toLowerCase());
  },

  sendInvitations: async (attendeeIds: string[], eventId: string): Promise<{ sent: number; failed: number }> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-invitation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ attendee_ids: attendeeIds, event_id: eventId }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to send invitations');
    }

    return response.json();
  },
};
