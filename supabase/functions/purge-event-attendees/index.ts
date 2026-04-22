import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PurgeRequest {
  event_id: string;
  confirm?: boolean;
  delete_auth_users?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate caller as superuser
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const callerId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify superuser role
    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('is_active', true);

    if (roleErr) return jsonResponse({ error: 'Role check failed' }, 500);
    const isSuperuser = (roleRows ?? []).some((r) => r.role === 'superuser');
    if (!isSuperuser) {
      return jsonResponse({ error: 'Forbidden: superuser role required' }, 403);
    }

    const body: PurgeRequest = await req.json();
    const { event_id, confirm = false, delete_auth_users = true } = body;

    if (!event_id || typeof event_id !== 'string') {
      return jsonResponse({ error: 'event_id is required' }, 400);
    }

    // Verify event exists, get event_code
    const { data: eventRow, error: eventErr } = await admin
      .from('events')
      .select('id, event_code, name')
      .eq('id', event_id)
      .maybeSingle();

    if (eventErr || !eventRow) {
      return jsonResponse({ error: 'Event not found' }, 404);
    }

    // Collect attendee IDs and their user_ids
    const { data: attendees, error: attErr } = await admin
      .from('attendees')
      .select('id, user_id')
      .eq('event_id', event_id);

    if (attErr) return jsonResponse({ error: 'Failed to list attendees' }, 500);

    const attendeeIds = (attendees ?? []).map((a) => a.id);
    const userIds = (attendees ?? []).map((a) => a.user_id).filter((u): u is string => !!u);

    // Collect conversation IDs for the event
    const { data: convs } = await admin
      .from('chat_conversations')
      .select('id')
      .eq('event_id', event_id);
    const conversationIds = (convs ?? []).map((c) => c.id);

    // Collect message IDs in those conversations
    let messageIds: string[] = [];
    if (conversationIds.length > 0) {
      const { data: msgs } = await admin
        .from('chat_messages')
        .select('id')
        .in('conversation_id', conversationIds);
      messageIds = (msgs ?? []).map((m) => m.id);
    }

    // Collect attendee_service IDs to drop tickets
    let attendeeServiceIds: string[] = [];
    if (attendeeIds.length > 0) {
      const { data: as } = await admin
        .from('attendee_services')
        .select('id')
        .in('attendee_id', attendeeIds);
      attendeeServiceIds = (as ?? []).map((a) => a.id);
    }

    // Build counts for dry-run (and final report)
    const counts: Record<string, number> = {
      attendees: attendeeIds.length,
      auth_users_candidates: userIds.length,
      chat_conversations: conversationIds.length,
      chat_messages: messageIds.length,
      attendee_services: attendeeServiceIds.length,
    };

    // Helper to count by filter
    async function countTable(
      table: string,
      column: string,
      values: string[] | string,
    ): Promise<number> {
      if (Array.isArray(values) && values.length === 0) return 0;
      const q = admin.from(table).select('*', { count: 'exact', head: true });
      const filtered = Array.isArray(values) ? q.in(column, values) : q.eq(column, values);
      const { count } = await filtered;
      return count ?? 0;
    }

    counts.chat_attachments = await countTable('chat_attachments', 'message_id', messageIds);
    counts.chat_participants = await countTable(
      'chat_participants',
      'conversation_id',
      conversationIds,
    );
    counts.poll_responses = await countTable('poll_responses', 'attendee_id', attendeeIds);
    counts.sponsor_leads = await countTable('sponsor_leads', 'event_id', event_id);
    counts.ratings = await countTable('ratings', 'event_id', event_id);
    counts.session_interests = await countTable('session_interests', 'event_id', event_id);
    counts.contacts = await countTable('contacts', 'event_id', event_id);
    counts.attendee_notes = await countTable('attendee_notes', 'event_id', event_id);
    counts.attendee_checkins = await countTable('attendee_checkins', 'attendee_id', attendeeIds);
    counts.invitation_send_log = await countTable('invitation_send_log', 'event_id', event_id);
    counts.attendee_announcement_views = await countTable(
      'attendee_announcement_views',
      'event_id',
      event_id,
    );
    counts.attendee_message_views = await countTable(
      'attendee_message_views',
      'event_id',
      event_id,
    );
    counts.push_subscriptions = await countTable('push_subscriptions', 'event_id', event_id);
    counts.notifications = await countTable('notifications', 'event_id', event_id);
    counts.service_tickets =
      attendeeServiceIds.length === 0
        ? 0
        : await countTable('service_tickets', 'attendee_service_id', attendeeServiceIds);
    counts.access_attempts = await countTable('access_attempts', 'event_code', eventRow.event_code);

    if (!confirm) {
      return jsonResponse({
        dry_run: true,
        event: eventRow,
        will_delete: counts,
        delete_auth_users,
      });
    }

    // === DELETION PHASE ===
    const deleted: Record<string, number> = {};

    async function delIn(table: string, column: string, values: string[]) {
      if (values.length === 0) {
        deleted[table] = 0;
        return;
      }
      // chunk to avoid huge IN lists
      const CHUNK = 500;
      let total = 0;
      for (let i = 0; i < values.length; i += CHUNK) {
        const slice = values.slice(i, i + CHUNK);
        const { error, count } = await admin
          .from(table)
          .delete({ count: 'exact' })
          .in(column, slice);
        if (error) throw new Error(`${table}: ${error.message}`);
        total += count ?? 0;
      }
      deleted[table] = total;
    }

    async function delEq(table: string, column: string, value: string) {
      const { error, count } = await admin
        .from(table)
        .delete({ count: 'exact' })
        .eq(column, value);
      if (error) throw new Error(`${table}: ${error.message}`);
      deleted[table] = count ?? 0;
    }

    // Order matters — leaves first
    await delIn('chat_attachments', 'message_id', messageIds);
    await delIn('chat_messages', 'conversation_id', conversationIds);
    await delIn('chat_participants', 'conversation_id', conversationIds);
    await delEq('chat_conversations', 'event_id', event_id);

    await delIn('poll_responses', 'attendee_id', attendeeIds);
    await delEq('sponsor_leads', 'event_id', event_id);
    await delEq('ratings', 'event_id', event_id);
    await delEq('session_interests', 'event_id', event_id);
    await delEq('contacts', 'event_id', event_id);
    await delEq('attendee_notes', 'event_id', event_id);
    await delIn('attendee_checkins', 'attendee_id', attendeeIds);
    await delEq('invitation_send_log', 'event_id', event_id);
    await delEq('attendee_announcement_views', 'event_id', event_id);
    await delEq('attendee_message_views', 'event_id', event_id);
    await delEq('push_subscriptions', 'event_id', event_id);
    await delEq('notifications', 'event_id', event_id);

    await delIn('service_tickets', 'attendee_service_id', attendeeServiceIds);
    await delIn('attendee_services', 'attendee_id', attendeeIds);

    await delEq('attendees', 'event_id', event_id);
    await delEq('access_attempts', 'event_code', eventRow.event_code);

    // Auth users
    let authDeleted = 0;
    let authFailed = 0;
    if (delete_auth_users && userIds.length > 0) {
      for (const uid of userIds) {
        const { error } = await admin.auth.admin.deleteUser(uid);
        if (error) {
          authFailed++;
          console.error(`Failed to delete auth user ${uid}:`, error.message);
        } else {
          authDeleted++;
        }
      }
    }
    deleted.auth_users = authDeleted;
    if (authFailed > 0) deleted.auth_users_failed = authFailed;

    // Snapshot remaining event configuration
    const [
      { count: agendaCount },
      { count: sponsorsCount },
      { count: serviceCatalogCount },
      { count: pollsCount },
      { count: documentsCount },
    ] = await Promise.all([
      admin
        .from('event_activities')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event_id),
      admin.from('sponsors').select('*', { count: 'exact', head: true }).eq('event_id', event_id),
      admin
        .from('service_catalog')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event_id),
      admin.from('polls').select('*', { count: 'exact', head: true }).eq('event_id', event_id),
      admin.from('documents').select('*', { count: 'exact', head: true }).eq('event_id', event_id),
    ]);

    return jsonResponse({
      dry_run: false,
      event: eventRow,
      deleted,
      remaining: {
        agenda_sessions: agendaCount ?? 0,
        sponsors: sponsorsCount ?? 0,
        service_catalog: serviceCatalogCount ?? 0,
        polls: pollsCount ?? 0,
        documents: documentsCount ?? 0,
      },
    });
  } catch (err) {
    console.error('Purge error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
