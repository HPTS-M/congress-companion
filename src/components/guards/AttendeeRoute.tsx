import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEventSlug } from '@/hooks/useEvent';
import { Skeleton } from '@/components/ui/skeleton';

interface AttendeeRouteProps {
  children: React.ReactNode;
}

export function AttendeeRoute({ children }: AttendeeRouteProps) {
  const { isAuthenticated, isAttendee, isLoading } = useAuth();
  const eventSlug = useEventSlug();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (!isAuthenticated || !isAttendee) {
    return <Navigate to={`/${eventSlug}`} replace />;
  }

  return <>{children}</>;
}
