import { supabase } from '@/integrations/supabase/client';

export interface StaffMember {
  id: string;
  event_id: string;
  user_id: string | null;
  full_name: string;
  assigned_room: string | null;
  contact_email: string;
  invitation_status: string | null;
  is_active: boolean;
  last_login: string | null;
  access_expires_at: string | null;
  created_at: string | null;
}

export const adminStaffService = {
  async getStaffMembers(eventId: string): Promise<StaffMember[]> {
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('event_id', eventId)
      .order('full_name');

    if (error) throw new Error(error.message);
    return (data ?? []) as StaffMember[];
  },

  async createStaffMember(member: {
    event_id: string;
    full_name: string;
    contact_email: string;
    assigned_room?: string;
    access_expires_at?: string;
  }): Promise<StaffMember> {
    const { data, error } = await supabase
      .from('staff_members')
      .insert(member)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as StaffMember;
  },

  async updateStaffMember(id: string, updates: Partial<StaffMember>): Promise<void> {
    const { error } = await supabase
      .from('staff_members')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  async deleteStaffMember(id: string): Promise<void> {
    const { error } = await supabase
      .from('staff_members')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  async setInvitationStatus(id: string, status: 'pending' | 'active'): Promise<void> {
    const { error } = await supabase
      .from('staff_members')
      .update({ invitation_status: status })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('staff_members')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async inviteStaffUser(params: {
    email: string;
    full_name: string;
    event_id: string;
    assigned_room?: string;
    access_expires_at?: string;
    action?: string;
  }): Promise<{ success: boolean; userId?: string; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(params),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to invite staff');
    return data;
  },

  async getStaffByUserId(userId: string, eventId: string): Promise<StaffMember | null> {
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as StaffMember | null;
  },
};
