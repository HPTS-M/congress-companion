import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { providerPortalService, type ProviderSession } from '@/services/provider-portal.service';

interface UseProviderSessionOptions {
  /**
   * If true (default), redirects to /change-password when password_changed === false.
   * Set to false on the change-password page itself.
   */
  requirePasswordChanged?: boolean;
}

interface UseProviderSessionReturn {
  session: ProviderSession | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

type ProviderRouteParams = {
  eventSlug: string;
};

/**
 * Centralizes provider portal session verification used across /provider/* pages.
 * - Verifies a valid provider session exists.
 * - Verifies the session belongs to the current event slug.
 * - Optionally enforces that the provider has changed their initial password.
 * - Redirects to the appropriate route on any failure.
 */
export function useProviderSession(
  options: UseProviderSessionOptions = {}
): UseProviderSessionReturn {
  const { requirePasswordChanged = true } = options;
  const { eventSlug } = useParams<ProviderRouteParams>();
  const navigate = useNavigate();
  const [session, setSession] = useState<ProviderSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!eventSlug) return;

    let cancelled = false;

    const loadSession = async (): Promise<void> => {
      const s = await providerPortalService.getProviderSession();

      if (cancelled) return;

      if (!s || s.event_code !== eventSlug) {
        navigate(`/${eventSlug}/provider`, { replace: true });
        return;
      }

      if (requirePasswordChanged && !s.password_changed) {
        navigate(`/${eventSlug}/provider/change-password`, { replace: true });
        return;
      }

      setSession(s);
      setIsLoading(false);
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [eventSlug, navigate, requirePasswordChanged]);

  const logout = useCallback(async (): Promise<void> => {
    await providerPortalService.logout();
    navigate(`/${eventSlug}/provider`, { replace: true });
  }, [eventSlug, navigate]);

  return { session, isLoading, logout };
}

