import { supabase } from '@/integrations/supabase/client';

export interface ProviderSession {
  id: string;
  company_name: string;
  category: string;
  event_id: string;
  event_name: string;
  event_code: string;
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

const STORAGE_KEY = 'provider_session';

export const providerPortalService = {
  async login(accessCode: string, eventCode: string): Promise<ProviderSession> {
    const { data, error } = await supabase.rpc('verify_provider_access', {
      _access_code: accessCode.toUpperCase().trim(),
      _event_code: eventCode,
    });
    if (error) throw new Error(error.message);

    const result = data as any;
    if (!result?.success) {
      throw new Error(result?.error ?? 'Invalid code');
    }

    const session: ProviderSession = {
      id: result.provider.id,
      company_name: result.provider.company_name,
      category: result.provider.category,
      event_id: result.provider.event_id,
      event_name: result.event.name,
      event_code: result.event.event_code,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  },

  getSession(): ProviderSession | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as ProviderSession;
    } catch {
      return null;
    }
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
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
    return data as any;
  },
};
