import { supabase } from '@/integrations/supabase/client';

export interface ProviderSession {
  provider_id: string;
  company_name: string;
  category: string;
  event_id: string;
  event_name: string;
  event_code: string;
  password_changed: boolean;
}

export interface ProviderServiceItem {
  id: string;
  name: string;
  service_type: string;
  valid_day: number | null;
  valid_from: string | null;
  valid_until: string | null;
  location: string | null;
  attendee_count: number;
}

export interface ProviderAttendeeItem {
  attendee_service_id: string;
  attendee_name: string;
  credential_code: string;
  status: string | null;
  ticket_code: string | null;
  is_used: boolean;
  used_at: string | null;
}

export const providerPortalService = {
  /**
   * Get the current provider session from Supabase Auth.
   */
  async getProviderSession(): Promise<ProviderSession | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: provider } = await supabase
      .from('providers')
      .select('id, company_name, category, event_id, password_changed')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!provider) return null;

    const { data: event } = await supabase
      .from('events')
      .select('name, event_code')
      .eq('id', provider.event_id)
      .single();

    if (!event) return null;

    return {
      provider_id: provider.id,
      company_name: provider.company_name,
      category: provider.category,
      event_id: provider.event_id,
      event_name: event.name,
      event_code: event.event_code,
      password_changed: (provider as any).password_changed ?? false,
    };
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getServices(providerId: string): Promise<ProviderServiceItem[]> {
    const { data, error } = await supabase.rpc('get_provider_assigned_services', {
      _provider_id: providerId,
    });
    if (error) throw new Error(error.message);
    return (data as unknown as ProviderServiceItem[]) ?? [];
  },

  async getServiceAttendees(providerId: string, serviceCatalogId: string): Promise<ProviderAttendeeItem[]> {
    const { data, error } = await supabase.rpc('get_provider_service_attendees', {
      _provider_id: providerId,
      _service_catalog_id: serviceCatalogId,
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return (data as unknown as ProviderAttendeeItem[]) ?? [];
  },

  async validateTicket(providerId: string, attendeeServiceId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data, error } = await supabase.rpc('provider_validate_ticket', {
      _provider_id: providerId,
      _attendee_service_id: attendeeServiceId,
    });
    if (error) throw new Error(error.message);
    const result = data as any;
    // Fire-and-forget activity log
    this.logActivity('ticket_validated', { attendee_service_id: attendeeServiceId, success: !!result?.success }).catch(() => {});
    return result;
  },

  async logActivity(activityType: string, metadata: Record<string, any> = {}): Promise<void> {
    try {
      await (supabase as any).rpc('log_provider_activity', {
        _activity_type: activityType,
        _metadata: metadata,
      });
    } catch {
      // silent
    }
  },
};
