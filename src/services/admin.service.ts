import { supabase } from '@/integrations/supabase/client';

export interface EventStats {
  totalAttendees: number;
  confirmedAttendees: number;
  checkedInAttendees: number;
  totalActivities: number;
  totalCheckins: number;
  totalDocuments: number;
  totalAnnouncements: number;
  servicesDelivered: number;
  servicesDeliveredQr: number;
  servicesDeliveredManual: number;
}

export const adminService = {
  getEventStats: async (eventId: string): Promise<EventStats> => {
    // Use RPC for core stats
    const { data: rpcData } = await supabase.rpc('get_event_statistics', { _event_id: eventId });

    const stats = (rpcData as Record<string, number> | null) ?? {};

    // Catalog ids for this event so service stats stay event-scoped
    const { data: catalog } = await supabase
      .from('service_catalog')
      .select('id')
      .eq('event_id', eventId);
    const catalogIds = (catalog ?? []).map((c) => c.id);

    const [docsResult, announcementsResult, ticketsResult] = await Promise.all([
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('announcements').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
      catalogIds.length > 0
        ? supabase
            .from('attendee_services')
            .select('id, status, service_tickets(is_used, validation_method)')
            .in('service_catalog_id', catalogIds)
            .eq('status', 'completed')
        : Promise.resolve({ data: [] as Array<{ id: string; status: string | null; service_tickets: Array<{ is_used: boolean | null; validation_method: string | null }> }> }),
    ]);

    const completed = (ticketsResult.data ?? []) as Array<{ service_tickets: Array<{ is_used: boolean | null; validation_method: string | null }> }>;
    let qr = 0;
    let manual = 0;
    for (const t of completed) {
      const usedTicket = (t.service_tickets ?? []).find((st) => st.is_used);
      if (usedTicket?.validation_method === 'manual_admin') manual++;
      else qr++;
    }

    return {
      totalAttendees: stats.total_attendees ?? 0,
      confirmedAttendees: stats.confirmed_attendees ?? 0,
      checkedInAttendees: stats.checked_in_attendees ?? 0,
      totalActivities: stats.total_activities ?? 0,
      totalCheckins: stats.total_checkins ?? 0,
      totalDocuments: docsResult.count ?? 0,
      totalAnnouncements: announcementsResult.count ?? 0,
      servicesDelivered: completed.length,
      servicesDeliveredQr: qr,
      servicesDeliveredManual: manual,
    };
  },

  getRecentAnnouncements: async (eventId: string, limit = 5) => {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, sent_at')
      .eq('event_id', eventId)
      .order('sent_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },
};
