import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const authService = {
  /**
   * Verify attendee access code via edge function.
   * Returns session tokens + attendee data on success.
   */
  verifyAccessCode: async (accessCode: string, eventCode: string, forceLogin = false) => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/verify-access-code`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify({
          access_code: accessCode,
          event_code: eventCode,
          force_login: forceLogin,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Edge function returns generic error messages only
      throw new Error(data.error || 'Server error');
    }

    return data as {
      success: boolean;
      email_otp: string;
      email: string;
      attendee: {
        id: string;
        full_name: string;
        credential_code: string;
        registration_status: string;
        event_id: string;
      };
      event: {
        id: string;
        name: string;
        event_code: string;
        start_date: string;
        end_date: string;
        venue_name: string | null;
      };
    };
  },

  /**
   * Establish Supabase session using OTP from edge function.
   */
  establishSession: async (email: string, emailOtp: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: emailOtp,
      type: 'magiclink',
    });

    if (error) throw error;
    return data;
  },

  /**
   * Admin login with email and password.
   */
  adminLogin: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Check if user has admin/coordinator/superuser role for an event.
   */
  verifyAdminAccess: async (userId: string, eventId: string): Promise<boolean> => {
    // Check if superuser (has access to everything)
    const { data: roles } = await supabase.rpc('get_user_roles', {
      _user_id: userId,
    });

    if (roles?.includes('superuser')) return true;

    // Check admin role
    if (roles?.includes('admin') || roles?.includes('coordinator')) {
      // Verify event staff assignment
      const { data: isStaff } = await supabase.rpc('is_event_staff', {
        _user_id: userId,
        _event_id: eventId,
      });

      return !!isStaff;
    }

    return false;
  },

  /**
   * Sign out the current user.
   */
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
