import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEventSlug } from '@/hooks/useEvent';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, isAdmin, isLoading, isProfileLoading, mfaEnrolled, mfaLevel } = useAuth();
  const eventSlug = useEventSlug();
  const location = useLocation();

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to={`/${eventSlug}/admin/login`} replace />;
  }

  // If admin has MFA enrolled but session is only aal1, force verification
  // (skip the check if we're already on the verify page)
  const verifyPath = `/${eventSlug}/admin/2fa/verify`;
  if (mfaEnrolled && mfaLevel === 'aal1' && location.pathname !== verifyPath) {
    return <Navigate to={verifyPath} replace />;
  }

  return <>{children}</>;
}
