import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEventSlug } from '@/hooks/useEvent';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, isAdmin, isLoading, isProfileLoading } = useAuth();
  const eventSlug = useEventSlug();

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

  return <>{children}</>;
}
