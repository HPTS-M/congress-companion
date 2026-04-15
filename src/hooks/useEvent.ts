import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { CongressEvent } from '@/types';

interface EventContextValue {
  event: CongressEvent | null;
  isLoading: boolean;
  error: string | null;
  eventSlug: string;
}

const EventContext = createContext<EventContextValue | null>(null);

export { EventContext };

export function useEventLoader(eventSlug: string) {
  return useQuery({
    queryKey: ['event', eventSlug],
    queryFn: async (): Promise<CongressEvent> => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_code, start_date, end_date, venue_name, venue_address, description, status, settings, organization_id, max_attendees')
        .ilike('event_code', eventSlug)
        .is('deleted_at', null)
        .single();

      if (error) throw new Error('EVENT_NOT_FOUND');
      return data as CongressEvent;
    },
    enabled: !!eventSlug,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });
}

export function useEvent(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}

export function useEventSlug(): string {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  return eventSlug ?? '';
}

export function useEventSettings() {
  const { event } = useEvent();
  const settings = (event?.settings ?? {}) as Record<string, unknown>;
  return {
    qrEnabled: settings.qr_enabled !== false,
    contactsEnabled: settings.contacts_enabled !== false,
    documentsEnabled: settings.documents_enabled !== false,
    notesEnabled: settings.notes_enabled !== false,
    messagingEnabled: settings.messaging_enabled !== false,
    announcementsEnabled: settings.announcements_enabled !== false,
    ratingsEnabled: settings.ratings_enabled !== false,
    venueMapEnabled: settings.venue_map_enabled !== false,
    pollsEnabled: settings.polls_enabled !== false,
    ticketsEnabled: settings.tickets_enabled !== false,
    commercialEnabled: settings.commercial_enabled !== false,
    bannerUrl: (settings.banner_url as string) || '',
    headerLogoUrl: (settings.header_logo_url as string) || '',
  };
}
