import { useState, useEffect, useCallback, createContext, useContext, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/services/auth.service';
import { purgePersistedCache } from '@/lib/query-persist';
import { useQueryClient } from '@tanstack/react-query';
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
  // MFA state (only relevant for admins)
  mfaEnrolled: boolean;
  mfaLevel: 'aal1' | 'aal2' | null;
  mfaFactorId: string | null;
}

interface AuthContextValue extends AuthState {
  loginWithCode: (accessCode: string, eventCode: string, forceLogin?: boolean) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<{ userId: string }>;
  logout: () => Promise<void>;
  refreshMfaState: () => Promise<void>;
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
    mfaEnrolled: false,
    mfaLevel: null,
    mfaFactorId: null,
  });
  const queryClient = useQueryClient();
  // Tracks the previously loaded attendee — when it changes we wipe the
  // persisted cache to prevent leaking data across attendees on shared devices.
  const lastAttendeeIdRef = useRef<string | null>(null);

  const refreshMfaState = useCallback(async () => {
    try {
      const [factorsData, aalData] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      const verifiedTotp = factorsData.data?.totp?.find((f) => f.status === 'verified');
      setState(prev => ({
        ...prev,
        mfaEnrolled: !!verifiedTotp,
        mfaFactorId: verifiedTotp?.id ?? null,
        mfaLevel: (aalData.data?.currentLevel ?? null) as 'aal1' | 'aal2' | null,
      }));
    } catch {
      setState(prev => ({ ...prev, mfaEnrolled: false, mfaFactorId: null, mfaLevel: null }));
    }
  }, []);

  useEffect(() => {
    // Tell the splash screen what we're doing right now.
    // Listener lives in index.html and works before React mounts.
    window.dispatchEvent(
      new CustomEvent('app:init', { detail: { step: 'Verificando sesión…' } }),
    );

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
        const newAttendeeId = (data as AttendeeProfile).id;
        // If we just switched attendees on this device, purge the persisted
        // cache BEFORE the rest of the app starts hydrating queries.
        if (
          lastAttendeeIdRef.current &&
          lastAttendeeIdRef.current !== newAttendeeId
        ) {
          queryClient.clear();
          await purgePersistedCache();
        }
        lastAttendeeIdRef.current = newAttendeeId;

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

      // Load MFA state for admins only
      if (hasAdminRole) {
        await refreshMfaState();
      }
    } finally {
      setState(prev => ({ ...prev, isProfileLoading: false }));
    }
  };

  const loginWithCode = useCallback(async (accessCode: string, eventCode: string, forceLogin = false) => {
    const result = await authService.verifyAccessCode(accessCode, eventCode, forceLogin);
    await authService.establishSession(result.email, {
      tokenHash: result.token_hash,
      emailOtp: result.email_otp,
    });
    // Session marker is already set by the edge function
  }, []);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    const result = await authService.adminLogin(email, password);
    return { userId: result.user.id };
  }, []);

  const logout = useCallback(async () => {
    // Clear session marker before signing out
    if (state.attendee?.id) {
      await supabase
        .from('attendees')
        .update({ last_session_id: null } as any)
        .eq('id', state.attendee.id);
    }
    await authService.logout();
    // Wipe in-memory + persisted query cache so the next attendee can't see
    // any of the previous attendee's data on a shared device.
    queryClient.clear();
    await purgePersistedCache();
    lastAttendeeIdRef.current = null;
    setState({
      session: null,
      user: null,
      attendee: null,
      isLoading: false,
      isProfileLoading: false,
      isAuthenticated: false,
      isAttendee: false,
      isAdmin: false,
      mfaEnrolled: false,
      mfaLevel: null,
      mfaFactorId: null,
    });
  }, [state.attendee?.id, queryClient]);

  return (
    <AuthContext.Provider value={{ ...state, loginWithCode, loginAdmin, logout, refreshMfaState }}>
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
