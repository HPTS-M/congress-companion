import { supabase } from '@/integrations/supabase/client';

export interface AttendanceReport {
  session_id: string;
  title: string;
  location: string | null;
  scheduled_date: string;
  start_time: string;
  total_checkins: number;
  total_interested: number;
}

export interface RatingComment {
  author_name: string;
  credential_code: string;
  comment: string;
  stars: number;
  created_at: string | null;
}

export interface RatingsReport {
  session_id: string;
  title: string;
  speaker_name: string | null;
  avg_stars: number;
  total_ratings: number;
  comments: RatingComment[];
}

export interface PollResponseReport {
  poll_id: string;
  question: string;
  poll_type: string;
  author_name: string;
  credential_code: string;
  option_text: string | null;
  text_response: string | null;
  created_at: string | null;
}

export interface LogisticsReport {
  service_id: string;
  name: string;
  service_type: string;
  valid_day: number | null;
  total: number;
  used: number;
  used_qr: number;
  used_manual: number;
  pending: number;
  cancelled: number;
}

export interface SponsorEngagementReport {
  sponsor_id: string;
  name: string;
  level: string;
  profile_views: number;
  whatsapp_clicks: number;
  website_clicks: number;
  leads_captured: number;
}

export const adminReportsService = {
  getAttendance: async (eventId: string): Promise<AttendanceReport[]> => {
    const { data: activities, error: actErr } = await supabase
      .from('event_activities')
      .select('id, title, location, scheduled_date, start_time')
      .eq('event_id', eventId)
      .order('scheduled_date')
      .order('start_time');
    if (actErr) throw new Error(actErr.message);

    const { data: checkins, error: chkErr } = await supabase
      .from('attendee_checkins')
      .select('activity_id');
    if (chkErr) throw new Error(chkErr.message);

    const { data: interests, error: intErr } = await supabase
      .from('session_interests')
      .select('session_id')
      .eq('event_id', eventId);
    if (intErr) throw new Error(intErr.message);

    const checkinCounts = new Map<string, number>();
    for (const c of checkins ?? []) {
      checkinCounts.set(c.activity_id, (checkinCounts.get(c.activity_id) ?? 0) + 1);
    }

    const interestCounts = new Map<string, number>();
    for (const i of interests ?? []) {
      interestCounts.set(i.session_id, (interestCounts.get(i.session_id) ?? 0) + 1);
    }

    const results: AttendanceReport[] = (activities ?? []).map((a) => ({
      session_id: a.id,
      title: a.title,
      location: a.location,
      scheduled_date: a.scheduled_date,
      start_time: a.start_time,
      total_checkins: checkinCounts.get(a.id) ?? 0,
      total_interested: interestCounts.get(a.id) ?? 0,
    }));

    return results
      .sort((a, b) => b.total_checkins - a.total_checkins)
      .slice(0, 10);
  },

  getRatings: async (eventId: string): Promise<RatingsReport[]> => {
    const { data: ratings, error: ratErr } = await supabase
      .from('ratings')
      .select('session_id, stars, comment, user_id, created_at')
      .eq('event_id', eventId);
    if (ratErr) throw new Error(ratErr.message);

    const { data: activities, error: actErr } = await supabase
      .from('event_activities')
      .select('id, title, speaker_name')
      .eq('event_id', eventId);
    if (actErr) throw new Error(actErr.message);

    const userIds = Array.from(
      new Set((ratings ?? []).map((r) => r.user_id).filter(Boolean) as string[])
    );
    const attMap = new Map<string, { full_name: string; credential_code: string }>();
    if (userIds.length > 0) {
      const { data: atts } = await supabase
        .from('attendees')
        .select('id, full_name, credential_code')
        .in('id', userIds);
      for (const a of atts ?? []) {
        attMap.set(a.id, { full_name: a.full_name, credential_code: a.credential_code });
      }
    }

    const actMap = new Map<string, { title: string; speaker_name: string | null }>();
    for (const a of activities ?? []) {
      actMap.set(a.id, { title: a.title, speaker_name: a.speaker_name });
    }

    const grouped = new Map<string, { stars: number[]; comments: RatingComment[] }>();
    for (const r of ratings ?? []) {
      const g = grouped.get(r.session_id) ?? { stars: [], comments: [] };
      g.stars.push(r.stars);
      if (r.comment) {
        const author = attMap.get(r.user_id);
        g.comments.push({
          author_name: author?.full_name ?? '(asistente eliminado)',
          credential_code: author?.credential_code ?? '',
          comment: r.comment,
          stars: r.stars,
          created_at: r.created_at,
        });
      }
      grouped.set(r.session_id, g);
    }

    const results: RatingsReport[] = [];
    for (const [sessionId, data] of grouped) {
      const act = actMap.get(sessionId);
      if (!act) continue;
      const avg = data.stars.reduce((a, b) => a + b, 0) / data.stars.length;
      results.push({
        session_id: sessionId,
        title: act.title,
        speaker_name: act.speaker_name,
        avg_stars: Math.round(avg * 10) / 10,
        total_ratings: data.stars.length,
        comments: data.comments,
      });
    }

    return results.sort((a, b) => b.avg_stars - a.avg_stars);
  },

  getPollResponses: async (eventId: string): Promise<PollResponseReport[]> => {
    const { data: polls, error: pErr } = await supabase
      .from('polls')
      .select('id, question, poll_type')
      .eq('event_id', eventId);
    if (pErr) throw new Error(pErr.message);
    const pollMap = new Map((polls ?? []).map((p) => [p.id, p]));
    const pollIds = (polls ?? []).map((p) => p.id);
    if (pollIds.length === 0) return [];

    const { data: responses, error: rErr } = await supabase
      .from('poll_responses')
      .select('poll_id, attendee_id, option_id, text_response, created_at')
      .in('poll_id', pollIds)
      .order('created_at', { ascending: false });
    if (rErr) throw new Error(rErr.message);

    const optionIds = Array.from(
      new Set((responses ?? []).map((r) => r.option_id).filter(Boolean) as string[])
    );
    const optMap = new Map<string, string>();
    if (optionIds.length > 0) {
      const { data: opts } = await supabase
        .from('poll_options')
        .select('id, option_text')
        .in('id', optionIds);
      for (const o of opts ?? []) optMap.set(o.id, o.option_text);
    }

    const attIds = Array.from(new Set((responses ?? []).map((r) => r.attendee_id)));
    const attMap = new Map<string, { full_name: string; credential_code: string }>();
    if (attIds.length > 0) {
      const { data: atts } = await supabase
        .from('attendees')
        .select('id, full_name, credential_code')
        .in('id', attIds);
      for (const a of atts ?? []) {
        attMap.set(a.id, { full_name: a.full_name, credential_code: a.credential_code });
      }
    }

    return (responses ?? []).map((r) => {
      const poll = pollMap.get(r.poll_id);
      const att = attMap.get(r.attendee_id);
      return {
        poll_id: r.poll_id,
        question: poll?.question ?? '',
        poll_type: poll?.poll_type ?? '',
        author_name: att?.full_name ?? '(asistente eliminado)',
        credential_code: att?.credential_code ?? '',
        option_text: r.option_id ? optMap.get(r.option_id) ?? null : null,
        text_response: r.text_response,
        created_at: r.created_at,
      };
    });
  },

  getLogistics: async (eventId: string): Promise<LogisticsReport[]> => {
    const { data: catalog, error: catErr } = await supabase
      .from('service_catalog')
      .select('id, name, service_type, valid_day')
      .eq('event_id', eventId);
    if (catErr) throw new Error(catErr.message);

    const catalogIds = (catalog ?? []).map((c) => c.id);
    if (catalogIds.length === 0) return [];

    const { data: services, error: svcErr } = await supabase
      .from('attendee_services')
      .select('id, service_catalog_id, status, service_tickets(is_used, validation_method)')
      .in('service_catalog_id', catalogIds);
    if (svcErr) throw new Error(svcErr.message);

    const counts = new Map<string, { total: number; used: number; used_qr: number; used_manual: number; pending: number; cancelled: number }>();
    for (const s of services ?? []) {
      const c = counts.get(s.service_catalog_id) ?? { total: 0, used: 0, used_qr: 0, used_manual: 0, pending: 0, cancelled: 0 };
      c.total++;
      if (s.status === 'completed') {
        c.used++;
        const tickets = (s as { service_tickets?: Array<{ is_used: boolean | null; validation_method: string | null }> }).service_tickets ?? [];
        const usedTicket = tickets.find((t) => t.is_used);
        if (usedTicket?.validation_method === 'manual_admin') c.used_manual++;
        else c.used_qr++;
      } else if (s.status === 'cancelled') c.cancelled++;
      else c.pending++;
      counts.set(s.service_catalog_id, c);
    }

    return (catalog ?? []).map((cat) => {
      const c = counts.get(cat.id) ?? { total: 0, used: 0, used_qr: 0, used_manual: 0, pending: 0, cancelled: 0 };
      return {
        service_id: cat.id,
        name: cat.name,
        service_type: cat.service_type,
        valid_day: cat.valid_day,
        ...c,
      };
    });
  },

  getSponsorEngagement: async (eventId: string): Promise<SponsorEngagementReport[]> => {
    const { data: sponsors, error: spErr } = await supabase
      .from('sponsors')
      .select('id, name, level, profile_views, whatsapp_clicks, website_clicks')
      .eq('event_id', eventId);
    if (spErr) throw new Error(spErr.message);

    const { data: leads, error: ldErr } = await supabase
      .from('sponsor_leads')
      .select('sponsor_id')
      .eq('event_id', eventId);
    if (ldErr) throw new Error(ldErr.message);

    const leadCounts = new Map<string, number>();
    for (const l of leads ?? []) {
      leadCounts.set(l.sponsor_id, (leadCounts.get(l.sponsor_id) ?? 0) + 1);
    }

    return (sponsors ?? [])
      .map((s) => ({
        sponsor_id: s.id,
        name: s.name,
        level: s.level,
        profile_views: s.profile_views ?? 0,
        whatsapp_clicks: s.whatsapp_clicks ?? 0,
        website_clicks: s.website_clicks ?? 0,
        leads_captured: leadCounts.get(s.id) ?? 0,
      }))
      .sort((a, b) => {
        const totalA = a.profile_views + a.whatsapp_clicks + a.leads_captured;
        const totalB = b.profile_views + b.whatsapp_clicks + b.leads_captured;
        return totalB - totalA;
      });
  },

  getSummaryStats: async (eventId: string) => {
    // First fetch catalog ids for this event so service stats stay event-scoped
    const { data: catalog } = await supabase
      .from('service_catalog')
      .select('id')
      .eq('event_id', eventId);
    const catalogIds = (catalog ?? []).map((c) => c.id);

    const [{ count: attendeeCount }, { count: activityCount }, ratingsRes, ticketsRes] = await Promise.all([
      supabase.from('attendees').select('*', { count: 'exact', head: true }).eq('event_id', eventId).is('deleted_at', null),
      supabase.from('event_activities').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('ratings').select('stars').eq('event_id', eventId),
      catalogIds.length > 0
        ? supabase
            .from('attendee_services')
            .select('id, status, service_tickets(is_used, validation_method)')
            .in('service_catalog_id', catalogIds)
        : Promise.resolve({ data: [] as Array<{ id: string; status: string | null; service_tickets: Array<{ is_used: boolean | null; validation_method: string | null }> }> }),
    ]);

    const ratings = ratingsRes.data ?? [];
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length) * 10) / 10
      : 0;

    const tickets = (ticketsRes.data ?? []) as Array<{ status: string | null; service_tickets: Array<{ is_used: boolean | null; validation_method: string | null }> }>;
    const completed = tickets.filter((t) => t.status === 'completed');
    let usedQr = 0;
    let usedManual = 0;
    for (const t of completed) {
      const used = (t.service_tickets ?? []).find((st) => st.is_used);
      if (used?.validation_method === 'manual_admin') usedManual++;
      else usedQr++;
    }

    return {
      totalAttendees: attendeeCount ?? 0,
      totalSessions: activityCount ?? 0,
      avgRating,
      usedTickets: completed.length,
      usedTicketsQr: usedQr,
      usedTicketsManual: usedManual,
    };
  },
};
