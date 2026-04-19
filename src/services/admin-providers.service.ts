import { supabase } from '@/integrations/supabase/client';

export interface ProviderRow {
  id: string;
  event_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  category: string;
  access_code: string;
  is_active: boolean | null;
  created_at: string | null;
  assigned_services: number;
  user_id: string | null;
  last_login: string | null;
  login_count: number;
  access_expires_at: string | null;
  password_changed: boolean;
}

export interface ProviderForm {
  company_name: string;
  category: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  access_code: string;
  is_active?: boolean;
}

export const adminProvidersService = {
  async getAll(eventId: string): Promise<ProviderRow[]> {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('event_id', eventId)
      .order('company_name');
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((p) => p.id);
    if (ids.length === 0) return (data ?? []).map((p) => ({
      ...p,
      assigned_services: 0,
      user_id: p.user_id ?? null,
      last_login: p.last_login ?? null,
      login_count: p.login_count ?? 0,
      access_expires_at: p.access_expires_at ?? null,
      password_changed: (p as any).password_changed ?? false,
    }));

    const { data: ps, error: psErr } = await supabase
      .from('provider_services')
      .select('provider_id')
      .in('provider_id', ids);
    if (psErr) throw new Error(psErr.message);

    const countMap = new Map<string, number>();
    for (const row of ps ?? []) {
      countMap.set(row.provider_id, (countMap.get(row.provider_id) ?? 0) + 1);
    }

    return (data ?? []).map((p) => ({
      ...p,
      assigned_services: countMap.get(p.id) ?? 0,
      user_id: p.user_id ?? null,
      last_login: p.last_login ?? null,
      login_count: p.login_count ?? 0,
      access_expires_at: p.access_expires_at ?? null,
      password_changed: (p as any).password_changed ?? false,
    }));
  },

  async create(eventId: string, form: ProviderForm): Promise<void> {
    const { error } = await supabase.from('providers').insert({
      event_id: eventId,
      company_name: form.company_name,
      category: form.category,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      access_code: form.access_code,
      is_active: form.is_active ?? true,
    });
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_EMAIL');
      throw new Error(error.message);
    }
  },

  async update(id: string, form: Partial<ProviderForm>): Promise<void> {
    const { error } = await supabase.from('providers').update(form).eq('id', id);
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_EMAIL');
      throw new Error(error.message);
    }
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('providers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.from('providers').update({ is_active: isActive }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getAssignedServiceIds(providerId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('provider_services')
      .select('service_catalog_id')
      .eq('provider_id', providerId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.service_catalog_id);
  },

  async setAssignedServices(providerId: string, serviceIds: string[]): Promise<void> {
    const { error: delErr } = await supabase
      .from('provider_services')
      .delete()
      .eq('provider_id', providerId);
    if (delErr) throw new Error(delErr.message);

    if (serviceIds.length > 0) {
      const rows = serviceIds.map((sid) => ({
        provider_id: providerId,
        service_catalog_id: sid,
      }));
      const { error } = await supabase.from('provider_services').insert(rows);
      if (error) throw new Error(error.message);
    }
  },

  generateAccessCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  async inviteProvider(providerId: string, email: string, eventId: string, eventSlug: string): Promise<{ action: string }> {
    const redirectTo = `${window.location.origin}/${eventSlug}/provider`;

    const { data, error } = await supabase.functions.invoke('create-provider-user', {
      body: {
        provider_id: providerId,
        email,
        event_id: eventId,
        redirect_to: redirectTo,
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    return { action: data?.action ?? 'invited' };
  },

  async resendInvite(providerId: string, email: string, eventId: string, eventSlug: string): Promise<void> {
    const redirectTo = `${window.location.origin}/${eventSlug}/provider`;

    const { data, error } = await supabase.functions.invoke('create-provider-user', {
      body: {
        provider_id: providerId,
        email,
        event_id: eventId,
        redirect_to: redirectTo,
        action: 'resend',
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
  },

  async reinviteProvider(providerId: string, newEmail: string, eventId: string, eventSlug: string): Promise<{ action: string }> {
    const redirectTo = `${window.location.origin}/${eventSlug}/provider`;

    const { data, error } = await supabase.functions.invoke('create-provider-user', {
      body: {
        provider_id: providerId,
        email: newEmail,
        event_id: eventId,
        redirect_to: redirectTo,
        action: 'reinvite',
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    return { action: data?.action ?? 'reinvited' };
  },
};
