import { useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Shows an in-app toast when a new announcement is delivered to this event.
 *  - Listens to INSERT (immediate) + UPDATE (scheduled dispatch sets sent_at)
 *  - Skips toast when user is already on /:eventSlug/announcements
 *  - Deduplicates by announcement id (guards against double Realtime delivery)
 */
export function useAnnouncementToasts(): void {
  const { attendee } = useAuth();
  const eventId = attendee?.event_id;
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { t } = useTranslation('announcements');
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`announcement-toasts:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => handleAnnouncement(payload.new, null),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'announcements',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => handleAnnouncement(payload.new, payload.old),
      )
      .subscribe();

    function handleAnnouncement(
      next: Record<string, any>,
      prev: Record<string, any> | null,
    ) {
      // Only when actually delivered (sent_at present) and either freshly sent
      // or its sent_at just changed (e.g. resend).
      const sentAt = next?.sent_at;
      if (!sentAt) return;
      if (prev && prev.sent_at === sentAt) return;

      const id: string = next.id;
      if (seenIdsRef.current.has(id)) return;
      seenIdsRef.current.add(id);

      // Suppress when user is already viewing the announcements list
      const slug = params.eventSlug;
      const onAnnouncementsPage =
        slug && location.pathname.startsWith(`/${slug}/announcements`);
      if (onAnnouncementsPage) return;

      const title = String(next.title ?? t('title'));
      const body = String(next.body ?? '').slice(0, 120);

      toast(title, {
        description: body,
        action: slug
          ? {
              label: t('toast.view'),
              onClick: () => navigate(`/${slug}/announcements`),
            }
          : undefined,
      });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, location.pathname, navigate, params.eventSlug, t]);
}
