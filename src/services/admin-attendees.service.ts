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

export interface InvitationLogEntry {
  id: string;
  attendee_id: string;
  event_id: string;
  status: 'sent' | 'failed' | 'skipped';
  reason: string | null;
  error_message: string | null;
  retries: number;
  attempted_at: string;
}

export const adminAttendeesService = {
  /**
   * Fetch a specific subset of attendees by ID for the given event.
   * Used to build a complete snapshot for bulk actions when the user's
   * selection spans pages/filters that may no longer be in the active view.
   */
  getAttendeesByIds: async (
    ids: string[],
    eventId: string,
  ): Promise<AttendeeWithServices[]> => {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('attendees')
      .select(
        'id, event_id, full_name, email, credential_code, external_credential_code, registration_status, specialty, institution, phone, registration_date, invitation_sent_at, created_at, user_id',
      )
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .in('id', ids);
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => ({ ...(a as AttendeeRow), servicesCount: 0 }));
  },

  getAttendees: async (
    eventId: string,
    search?: string,
    statusFilter?: string,
    filters?: AttendeeFilters,
  ): Promise<AttendeeWithServices[]> => {
    let query = supabase
      .from('attendees')
      .select(
        'id, event_id, full_name, email, credential_code, external_credential_code, registration_status, specialty, institution, phone, registration_date, invitation_sent_at, created_at, user_id',
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

  // --- Invitation audit log ---

  /** IDs of attendees whose last invitation attempt failed (no successful send). */
  getFailedInvitationIds: async (eventId: string): Promise<string[]> => {
    const { data, error } = await supabase.rpc('get_failed_invitation_attendee_ids', {
      _event_id: eventId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as string[];
  },

  /** Last N delivery attempts for one attendee, newest first. */
  getInvitationLog: async (
    attendeeId: string,
    limit: number = 10,
  ): Promise<InvitationLogEntry[]> => {
    const { data, error } = await supabase
      .from('invitation_send_log')
      .select('id, attendee_id, event_id, status, reason, error_message, retries, attempted_at')
      .eq('attendee_id', attendeeId)
      .order('attempted_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as InvitationLogEntry[];
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

  /**
   * Lookup existing attendees by lowercase email within an event.
   * Returns a map: lowercaseEmail → array of candidate attendees.
   * Used by the importer to detect single-match (auto-update) vs multi-match (ambiguous).
   */
  lookupAttendeesByEmails: async (
    eventId: string,
    emails: string[],
  ): Promise<
    Record<
      string,
      Array<{
        id: string;
        full_name: string;
        email: string;
        credential_code: string;
        external_credential_code: string | null;
        created_at: string | null;
      }>
    >
  > => {
    const normalized = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))];
    if (normalized.length === 0) return {};

    const { data, error } = await supabase
      .from('attendees')
      .select('id, full_name, email, credential_code, external_credential_code, created_at')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .in('email', normalized);

    if (error) throw new Error(error.message);

    const map: Record<string, Array<{
      id: string;
      full_name: string;
      email: string;
      credential_code: string;
      external_credential_code: string | null;
      created_at: string | null;
    }>> = {};
    (data ?? []).forEach((row) => {
      const key = row.email.toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        credential_code: row.credential_code,
        external_credential_code: row.external_credential_code ?? null,
        created_at: row.created_at,
      });
    });
    return map;
  },

  /**
   * Lookup existing attendees by external_credential_code (case + space insensitive)
   * within an event. Returns map: upperCode → single attendee (codes are unique
   * per event by DB constraint, so at most one match per code).
   */
  lookupAttendeesByExternalCodes: async (
    eventId: string,
    codes: string[],
  ): Promise<
    Record<
      string,
      {
        id: string;
        full_name: string;
        email: string;
        credential_code: string;
        external_credential_code: string | null;
      }
    >
  > => {
    const normalized = [
      ...new Set(codes.map((c) => (c ?? '').trim().toUpperCase()).filter(Boolean)),
    ];
    if (normalized.length === 0) return {};

    const { data, error } = await supabase
      .from('attendees')
      .select('id, full_name, email, credential_code, external_credential_code')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .not('external_credential_code', 'is', null);

    if (error) throw new Error(error.message);

    const map: Record<
      string,
      {
        id: string;
        full_name: string;
        email: string;
        credential_code: string;
        external_credential_code: string | null;
      }
    > = {};
    (data ?? []).forEach((row) => {
      const key = (row.external_credential_code ?? '').trim().toUpperCase();
      if (!key) return;
      if (!normalized.includes(key)) return;
      map[key] = {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        credential_code: row.credential_code,
        external_credential_code: row.external_credential_code ?? null,
      };
    });
    return map;
  },

  /**
   * Bulk upsert: combines INSERT (new) and UPDATE (existing) operations
   * driven by per-row resolutions. Used by the import flow when "update existing"
   * is enabled.
   *
   * Safety guarantees:
   *  - NEVER touches: credential_code, access_code_hash, registration_status,
   *    user_id, invitation_sent_at on UPDATE paths.
   *  - Pre-validates external_credential_code uniqueness within the event,
   *    excluding the target attendee for UPDATE rows.
   */
  bulkUpsertAttendees: async (
    eventId: string,
    rows: BulkAttendeeRow[],
    resolutions: Array<
      | { rowIndex: number; action: 'create' }
      | { rowIndex: number; action: 'update'; targetAttendeeId: string }
      | { rowIndex: number; action: 'skip' }
    >,
    registrationStatus: string = 'confirmed',
  ): Promise<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ rowIndex: number; reason: string }>;
    insertedIds: string[];
  }> => {
    // Pre-fetch existing external codes (with their attendee id) for uniqueness checks
    const { data: existingCodes, error: codesErr } = await supabase
      .from('attendees')
      .select('id, external_credential_code')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .not('external_credential_code', 'is', null);
    if (codesErr) throw new Error(codesErr.message);

    const codeOwner = new Map<string, string>(); // upperCode → attendeeId
    (existingCodes ?? []).forEach((c) => {
      const code = (c.external_credential_code ?? '').trim().toUpperCase();
      if (code) codeOwner.set(code, c.id);
    });

    // Detect duplicate external_credential_code WITHIN the upsert batch
    const codeBatchUsage = new Map<string, number[]>();
    resolutions.forEach((res) => {
      if (res.action === 'skip') return;
      const row = rows[res.rowIndex];
      const code = (row?.external_credential_code ?? '').trim().toUpperCase();
      if (!code) return;
      const list = codeBatchUsage.get(code) ?? [];
      list.push(res.rowIndex);
      codeBatchUsage.set(code, list);
    });

    const errors: Array<{ rowIndex: number; reason: string }> = [];
    const insertsToRun: Array<{ rowIndex: number; payload: Record<string, unknown> }> = [];
    const updatesToRun: Array<{ rowIndex: number; targetId: string; payload: Record<string, unknown> }> = [];
    let skipped = 0;

    for (const res of resolutions) {
      if (res.action === 'skip') {
        skipped += 1;
        continue;
      }
      const row = rows[res.rowIndex];
      if (!row) {
        errors.push({ rowIndex: res.rowIndex, reason: 'row_not_found' });
        continue;
      }

      const codeRaw = (row.external_credential_code ?? '').trim();
      const codeUpper = codeRaw.toUpperCase();

      // 1) Duplicate within the same import batch → block
      if (codeUpper) {
        const occurrences = codeBatchUsage.get(codeUpper) ?? [];
        if (occurrences.length > 1) {
          errors.push({ rowIndex: res.rowIndex, reason: 'duplicate_code_in_batch' });
          continue;
        }
      }

      // 2) Duplicate against existing DB row (excluding target on UPDATE)
      if (codeUpper) {
        const owner = codeOwner.get(codeUpper);
        if (owner && (res.action === 'create' || owner !== res.targetAttendeeId)) {
          errors.push({ rowIndex: res.rowIndex, reason: 'duplicate_code_in_db' });
          continue;
        }
      }

      if (res.action === 'create') {
        insertsToRun.push({
          rowIndex: res.rowIndex,
          payload: {
            event_id: eventId,
            full_name: row.full_name,
            email: row.email,
            specialty: row.specialty || null,
            institution: row.institution || null,
            registration_status: row.registration_status || registrationStatus,
            credential_code: '',
            external_credential_code: codeRaw || null,
          },
        });
      } else {
        // UPDATE — only the safe, non-PII-sensitive fields
        const updatePayload: Record<string, unknown> = {
          external_credential_code: codeRaw || null,
        };
        if (row.specialty) updatePayload.specialty = row.specialty;
        if (row.institution) updatePayload.institution = row.institution;
        // full_name updates allowed (organizer correction)
        if (row.full_name) updatePayload.full_name = row.full_name;

        updatesToRun.push({
          rowIndex: res.rowIndex,
          targetId: res.targetAttendeeId,
          payload: updatePayload,
        });
      }
    }

    // Execute inserts (single batch for efficiency)
    let insertedIds: string[] = [];
    let inserted = 0;
    if (insertsToRun.length > 0) {
      const { data: insertedData, error: insertErr } = await supabase
        .from('attendees')
        .insert(insertsToRun.map((i) => i.payload as never))
        .select('id');
      if (insertErr) {
        const reason =
          (insertErr as { code?: string }).code === '23505' &&
          insertErr.message.includes('attendees_event_external_code_unique')
            ? 'duplicate_external_code'
            : insertErr.message;
        insertsToRun.forEach((i) => errors.push({ rowIndex: i.rowIndex, reason }));
      } else {
        insertedIds = (insertedData ?? []).map((d) => d.id);
        inserted = insertedIds.length;
      }
    }

    // Execute updates sequentially (low volume; preserves per-row error isolation)
    let updated = 0;
    for (const u of updatesToRun) {
      const { error: updErr } = await supabase
        .from('attendees')
        .update(u.payload)
        .eq('id', u.targetId);
      if (updErr) {
        const reason =
          (updErr as { code?: string }).code === '23505' &&
          updErr.message.includes('attendees_event_external_code_unique')
            ? 'duplicate_external_code'
            : updErr.message;
        errors.push({ rowIndex: u.rowIndex, reason });
      } else {
        updated += 1;
      }
    }

    return { inserted, updated, skipped, errors, insertedIds };
  },

  getExistingExternalCodes: async (eventId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('attendees')
      .select('external_credential_code')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .not('external_credential_code', 'is', null);
    return (data ?? [])
      .map((a) => (a.external_credential_code ?? '').trim())
      .filter((c) => c.length > 0);
  },

  /**
   * Send credential emails. Auto-paginates `attendeeIds` in chunks of 50
   * (matching the edge function's per-request cap) and aggregates results.
   * Each request has an explicit 50s timeout via AbortController so a
   * stuck chunk can't block the rest of the batch.
   */
  sendInvitations: async (
    attendeeIds: string[],
    eventId: string,
  ): Promise<SendInvitationsResult> => {
    if (attendeeIds.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const url = `${supabaseUrl}/functions/v1/send-invitation-email`;

    const CHUNK_SIZE = 50;
    const REQUEST_TIMEOUT_MS = 50_000;

    const aggregated: Required<Pick<SendInvitationsResult, 'sent' | 'failed'>> & {
      skipped: number;
      skippedDetails: { id: string; reason: string }[];
      errors: SendInvitationFailure[];
    } = {
      sent: 0,
      failed: 0,
      skipped: 0,
      skippedDetails: [],
      errors: [],
    };

    for (let i = 0; i < attendeeIds.length; i += CHUNK_SIZE) {
      const chunk = attendeeIds.slice(i, i + CHUNK_SIZE);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ attendee_ids: chunk, event_id: eventId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          // Mark every attendee in this chunk as failed so the admin sees
          // which ones need a manual retry.
          aggregated.failed += chunk.length;
          chunk.forEach((id) =>
            aggregated.errors.push({
              id,
              error: `HTTP ${response.status}: ${errData.error ?? 'request_failed'}`,
            }),
          );
          continue;
        }

        const result = (await response.json()) as SendInvitationsResult;
        aggregated.sent += result.sent ?? 0;
        aggregated.failed += result.failed ?? 0;
        aggregated.skipped += result.skipped ?? 0;
        if (result.skippedDetails?.length) aggregated.skippedDetails.push(...result.skippedDetails);
        if (result.errors?.length) aggregated.errors.push(...result.errors);
      } catch (err) {
        const isAbort = (err as Error).name === 'AbortError';
        aggregated.failed += chunk.length;
        chunk.forEach((id) =>
          aggregated.errors.push({
            id,
            error: isAbort ? 'timeout' : `network_error: ${(err as Error).message}`,
          }),
        );
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return {
      sent: aggregated.sent,
      failed: aggregated.failed,
      skipped: aggregated.skipped || undefined,
      skippedDetails: aggregated.skippedDetails.length ? aggregated.skippedDetails : undefined,
      errors: aggregated.errors.length ? aggregated.errors : undefined,
    };
  },

  /**
   * IDs of attendees who never received a credential email.
   * Filters out cancelled and missing/invalid emails so the admin only
   * sees actionable candidates for "Retry pending credentials".
   */
  getPendingInvitationIds: async (eventId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('attendees')
      .select('id, email, registration_status')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .is('invitation_sent_at', null);

    if (error) throw new Error(error.message);
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (data ?? [])
      .filter(
        (a) =>
          a.registration_status !== 'cancelled' &&
          a.email &&
          EMAIL_RE.test(a.email.trim()),
      )
      .map((a) => a.id);
  },
};

export interface SendInvitationFailure {
  id: string;
  /** Raw technical message — useful for logs. */
  error: string;
  /**
   * Stable, human-readable failure category from the edge function.
   * Optional because timeouts/HTTP errors raised client-side don't set it.
   */
  reason?: 'rate_limited' | 'invalid_recipient' | 'resend_error' | 'db_error' | 'unknown';
}

export interface SendInvitationsResult {
  sent: number;
  failed: number;
  /** Server-side count of recipients excluded (cancelled / invalid email). */
  skipped?: number;
  skippedDetails?: { id: string; reason: string }[];
  errors?: SendInvitationFailure[];
}
