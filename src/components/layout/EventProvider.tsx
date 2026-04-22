import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEventLoader, EventContext } from '@/hooks/useEvent';
import { useAgendaRealtime } from '@/hooks/useAdminAgenda';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function EventProvider() {
  const { eventSlug = '' } = useParams<{ eventSlug: string }>();
  const { data: event, isLoading, error } = useEventLoader(eventSlug);
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  // Notify the splash screen what we're doing right now.
  // Decoupled via CustomEvent — the listener lives in index.html and works
  // even before/without React being mounted.
  useEffect(() => {
    if (isLoading) {
      window.dispatchEvent(
        new CustomEvent('app:init', { detail: { step: 'Cargando evento…' } }),
      );
    }
  }, [isLoading]);

  // Global agenda realtime sync — invalidates every dependent query
  // (admin + attendee views) when sessions change anywhere in the event.
  useAgendaRealtime(event?.id);

  // Mobile-first: realtime sync of the event row itself.
  // When the admin flips a setting toggle (qr_enabled, messaging_enabled, etc.),
  // every connected attendee's cache is invalidated within ~1s, so the bottom
  // nav and feature visibility update without waiting for staleTime to expire.
  useRealtimeInvalidate({
    channelName: `event-row-${event?.id ?? 'none'}`,
    table: 'events',
    filter: event?.id ? `id=eq.${event.id}` : undefined,
    event: 'UPDATE',
    queryKeys: [['event', eventSlug]],
    enabled: !!event?.id && isOnline,
  });

  if (isLoading) {
    // Phantom skeleton: imitates the final app shell so the user perceives
    // structure (header gradient, bottom nav silhouette, content card)
    // instead of a generic spinner. Matches AppHeader 56px + BottomNav 56px.
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header silhouette */}
        <div
          className="h-14 w-full"
          style={{ background: 'linear-gradient(135deg, #1A56A0 0%, #00B89F 100%)' }}
          aria-hidden="true"
        />
        {/* Bottom nav silhouette (mobile only) */}
        <div
          className="fixed top-14 left-0 right-0 z-40 flex items-center justify-around border-b border-border bg-background md:hidden"
          style={{ minHeight: '56px' }}
          aria-hidden="true"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-center gap-1 py-2">
              <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
              <div className="h-2 w-10 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Content card silhouette */}
        <main className="flex-1 px-4 pt-20 md:pt-8">
          <div className="mx-auto max-w-2xl space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </main>
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
