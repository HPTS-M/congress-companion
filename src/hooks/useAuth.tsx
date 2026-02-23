import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/services/auth.service';
import type { AttendeeProfile } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  attendee: AttendeeProfile | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  isAuthenticated: boolean;
  isAttendee: boolean;
  isAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  loginWithCode: (accessCode: string, eventCode: string) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<{ userId: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    attendee: null,
    isLoading: true,
    isProfileLoading: true,
    isAuthenticated: false,
    isAttendee: false,
    isAdmin: false,
  });

  useEffect(() => {
    // Set up auth listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setState(prev => {
          if (_event === 'SIGNED_OUT' && prev.isAuthenticated) {
            sessionStorage.setItem('session_expired', 'true');
          }
          return {
            ...prev,
            session,
            user: session?.user ?? null,
            isAuthenticated: !!session,
            isLoading: false,
          };
        });

        // Load attendee profile if user exists
        if (session?.user) {
          setTimeout(() => loadAttendeeProfile(session.user.id), 0);
        }
      }
    );

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isLoading: false,
        isProfileLoading: session?.user ? true : false,
      }));

      if (session?.user) {
        loadAttendeeProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadAttendeeProfile = async (userId: string) => {
    setState(prev => ({ ...prev, isProfileLoading: true }));
    try {
      const { data } = await supabase
        .from('attendees')
        .select('id, full_name, email, credential_code, registration_status, event_id, selected_package_id, phone, document_type, document_number')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (data) {
        setState(prev => ({
          ...prev,
          attendee: data as AttendeeProfile,
          isAttendee: true,
        }));
      }

      // Check admin roles
      const { data: roles } = await supabase.rpc('get_user_roles', {
        _user_id: userId,
      });

      const adminRoles = ['superuser', 'admin', 'coordinator', 'field_manager'];
      const hasAdminRole = roles?.some((r: string) => adminRoles.includes(r)) ?? false;

      setState(prev => ({
        ...prev,
        isAdmin: hasAdminRole,
      }));
    } finally {
      setState(prev => ({ ...prev, isProfileLoading: false }));
    }
  };

  const loginWithCode = useCallback(async (accessCode: string, eventCode: string) => {
    const result = await authService.verifyAccessCode(accessCode, eventCode);
    await authService.establishSession(result.email, result.email_otp);
  }, []);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    const result = await authService.adminLogin(email, password);
    return { userId: result.user.id };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({
      session: null,
      user: null,
      attendee: null,
      isLoading: false,
      isProfileLoading: false,
      isAuthenticated: false,
      isAttendee: false,
      isAdmin: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loginWithCode, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
