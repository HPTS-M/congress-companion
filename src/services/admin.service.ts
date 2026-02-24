import { supabase } from '@/integrations/supabase/client';

export interface EventStats {
  totalAttendees: number;
  confirmedAttendees: number;
  checkedInAttendees: number;
  totalActivities: number;
  totalCheckins: number;
  totalDocuments: number;
  totalAnnouncements: number;
}

export const adminService = {
  getEventStats: async (eventId: string): Promise<EventStats> => {
    // Use RPC for core stats
    const { data: rpcData } = await supabase.rpc('get_event_statistics', { _event_id: eventId });

    const stats = (rpcData as Record<string, number> | null) ?? {};

    // Supplement with documents + announcements counts
    const [docsResult, announcementsResult] = await Promise.all([
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ]);

    return {
      totalAttendees: stats.total_attendees ?? 0,
      confirmedAttendees: stats.confirmed_attendees ?? 0,
      checkedInAttendees: stats.checked_in_attendees ?? 0,
      totalActivities: stats.total_activities ?? 0,
      totalCheckins: stats.total_checkins ?? 0,
      totalDocuments: docsResult.count ?? 0,
      totalAnnouncements: announcementsResult.count ?? 0,
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
