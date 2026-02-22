import { Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEventLoader, EventContext } from '@/hooks/useEvent';
import { Skeleton } from '@/components/ui/skeleton';

export function EventProvider() {
  const { eventSlug = '' } = useParams<{ eventSlug: string }>();
  const { data: event, isLoading, error } = useEventLoader(eventSlug);
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t('auth.eventNotFound')}
          </h1>
          <p className="text-muted-foreground">
            {t('auth.enterEventCode')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <EventContext.Provider value={{ event, isLoading: false, error: null, eventSlug }}>
      <Outlet />
    </EventContext.Provider>
  );
}
