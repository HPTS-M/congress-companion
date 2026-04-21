import { supabase } from '@/integrations/supabase/client';

export interface AdminAnnouncement {
  id: string;
  event_id: string;
  title: string;
  body: string;
  reach: string | null;
  reach_count: number;
  sent_at: string | null;
  scheduled_for: string | null;
  last_edited_at: string | null;
  last_resent_at: string | null;
  updated_at: string | null;
}

export const adminCommunicationsService = {
  async getAnnouncements(eventId: string): Promise<AdminAnnouncement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, event_id, title, body, reach, reach_count, sent_at, scheduled_for, last_edited_at, last_resent_at, updated_at')
      .eq('event_id', eventId)
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .order('sent_at', { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as AdminAnnouncement[];
  },

  async getAnnouncementsCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async createAnnouncement(
    eventId: string,
    payload: { title: string; body: string; scheduledFor?: Date | null },
    reach = 'all',
  ): Promise<void> {
    const isScheduled = !!payload.scheduledFor && payload.scheduledFor.getTime() > Date.now();

    let reach_count = 0;
    if (!isScheduled) {
      reach_count = await this.getConfirmedAttendeesCount(eventId);
    }

    const { data: inserted, error } = await supabase
      .from('announcements')
      .insert({
        event_id: eventId,
        title: payload.title,
        body: payload.body,
        reach,
        reach_count,
        sent_at: isScheduled ? null : new Date().toISOString(),
        scheduled_for: isScheduled ? payload.scheduledFor!.toISOString() : null,
      })
      .select('id, sent_at')
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_TITLE');
      throw new Error(error.message);
    }

    // Fire Web Push for immediate sends (best-effort, never blocks UI)
    if (inserted && !isScheduled && inserted.sent_at) {
      void supabase.functions
        .invoke('send-announcement-push', { body: { announcement_id: inserted.id } })
        .catch((e) => console.warn('[push] dispatch failed', e));
    }
  },

  async updateAnnouncement(
    id: string,
    fields: { title: string; body: string; scheduledFor?: Date | null },
  ): Promise<void> {
    // Read current to know if it was already sent
    const { data: current, error: getErr } = await supabase
      .from('announcements')
      .select('sent_at')
      .eq('id', id)
      .single();
    if (getErr) throw new Error(getErr.message);

    const wasSent = !!current?.sent_at;
    const update: Record<string, unknown> = {
      title: fields.title,
      body: fields.body,
    };
    if (fields.scheduledFor !== undefined) {
      update.scheduled_for = fields.scheduledFor ? fields.scheduledFor.toISOString() : null;
    }
    if (wasSent) {
      update.last_edited_at = new Date().toISOString();
    }

    const { error } = await supabase.from('announcements').update(update).eq('id', id);
    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_TITLE');
      throw new Error(error.message);
    }
  },

  async resendAnnouncement(id: string, currentTitle: string, currentBody: string): Promise<void> {
    // Need the original sent state to check if changed since last send
    const { data: a, error: getErr } = await supabase
      .from('announcements')
      .select('id, event_id, title, body, sent_at, last_edited_at')
      .eq('id', id)
      .single();
    if (getErr) throw new Error(getErr.message);
    if (!a) throw new Error('NOT_FOUND');

    // Block: must have been actually changed (title or body different from stored)
    const titleChanged = a.title.trim() !== currentTitle.trim();
    const bodyChanged = a.body.trim() !== currentBody.trim();
    if (!titleChanged && !bodyChanged) {
      throw new Error('NO_CHANGES');
    }

    const reach_count = await this.getConfirmedAttendeesCount(a.event_id);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('announcements')
      .update({
        title: currentTitle,
        body: currentBody,
        sent_at: now,
        last_resent_at: now,
        last_edited_at: now,
        reach_count,
      })
      .eq('id', id);

    if (error) {
      if (error.code === '23505') throw new Error('DUPLICATE_TITLE');
      throw new Error(error.message);
    }

    // Fire Web Push for the resend (best-effort)
    void supabase.functions
      .invoke('send-announcement-push', { body: { announcement_id: id } })
      .catch((e) => console.warn('[push] resend dispatch failed', e));
  },

  async cancelScheduled(id: string): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)
      .is('sent_at', null);
    if (error) throw new Error(error.message);
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getConfirmedAttendeesCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from('attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('registration_status', 'confirmed')
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async getTodayAnnouncementsCount(eventId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const { count, error } = await supabase
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .gte('sent_at', `${today}T00:00:00`)
      .lte('sent_at', `${today}T23:59:59`);

    if (error) throw new Error(error.message);
    return count ?? 0;
  },
};
