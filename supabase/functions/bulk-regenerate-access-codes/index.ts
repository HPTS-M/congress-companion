import { createClient } from 'npm:@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { buildEventUrl } from '../_shared/build-event-url.ts';
import {
  renderEmail,
  renderEmailText,
  codeBlock,
  stepList,
  supportCallout,
  formatEventDateRange,
  escapeHtml,
} from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_BATCH = 50;
const BCRYPT_COST = 8;
// 200ms = ~5 emails/sec — within Resend default rate limit.
// 429 responses are still handled gracefully via the invitation_send_log.
const EMAIL_DELAY_MS = 200;

const requestSchema = z.object({
  event_id: z.string().uuid(),
  filter: z.enum(['all', 'never_logged_in', 'failed_invitations']).default('never_logged_in'),
  offset: z.number().int().min(0).default(0),
  batch_size: z.number().int().min(1).max(MAX_BATCH).default(MAX_BATCH),
  send_email: z.boolean().default(true),
});

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(length = 8): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join('');
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInvitationEmail(params: {
  attendeeName: string;
  eventName: string;
  accessCode: string;
  loginUrl: string;
  eventDates?: string;
  eventVenue?: string;
}) {
  const { attendeeName, eventName, accessCode, loginUrl, eventDates, eventVenue } = params;
  const steps = [
    'Toca el botón <strong>"Entrar al evento"</strong> que aparece más abajo.',
    'Ingresa tu <strong>código personal de 8 caracteres</strong>.',
  ];
  const supportBlock = supportCallout(
    '💬 ¿Sigues teniendo inconvenientes?',
    'Acércate a nuestro <strong>stand de soporte durante el congreso</strong> — nuestro equipo estará acompañándote en todo momento para resolver cualquier requerimiento.',
  );
  const body =
    codeBlock(accessCode, 'Tu código de acceso') +
    stepList('Cómo entrar', steps) +
    supportBlock;
  const opts = {
    preheader: 'Lamentamos los inconvenientes — este es tu nuevo código de acceso vigente.',
    eyebrow: '🔐 Nuevo código de acceso',
    headline: `Hola ${attendeeName}, tu código fue actualizado`,
    intro:
      'Lamentamos los inconvenientes causados por un <strong>incidente técnico que ya ha sido resuelto</strong>. Como medida de seguridad, hemos generado un <strong>nuevo código de acceso</strong> para ti.<br/><br/>Por favor, <strong>haz caso omiso de cualquier código anterior</strong> que hayas recibido y utiliza únicamente el que acompaña este correo.',
    body,
    ctaLabel: 'Entrar al evento',
    ctaUrl: loginUrl,
    ctaUrlHint: true,
    footerNote:
      'Este código es personal e intransferible. Agradecemos tu comprensión.',
    eventName,
    eventDates,
    eventVenue,
  };
  return {
    html: renderEmail(opts),
    text: renderEmailText({ ...opts, code: accessCode, codeLabel: 'Nuevo código de acceso', steps }),
    subject: `🔐 ${eventName} — Nuevo código de acceso`,
  };
}

interface AttendeeRow {
  id: string;
  full_name: string;
  email: string;
  user_id: string | null;
  invitation_sent_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }
    const userId = claimsData.claims.sub;
    const { data: roles } = await supabaseAuth.rpc('get_user_roles', { _user_id: userId });
    const isAdmin = (roles ?? []).some((r: string) => ['superuser', 'admin'].includes(r));
    if (!isAdmin) {
      return jsonResponse(403, { error: 'Forbidden: admin role required' });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' });
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, { error: 'Invalid input', details: parsed.error.issues });
    }
    const { event_id, filter, offset, batch_size, send_email } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, event_code, start_date, end_date, venue_name')
      .eq('id', event_id)
      .single();
    if (eventError || !event) {
      return jsonResponse(404, { error: 'Event not found' });
    }

    let baseSelect = supabaseAdmin
      .from('attendees')
      .select('id, full_name, email, user_id, invitation_sent_at', { count: 'exact' })
      .eq('event_id', event_id)
      .is('deleted_at', null)
      .neq('registration_status', 'cancelled')
      .order('created_at', { ascending: true });

    if (filter === 'never_logged_in') {
      baseSelect = baseSelect.is('user_id', null);
    } else if (filter === 'failed_invitations') {
      const { data: failedIds, error: failedErr } = await supabaseAdmin.rpc(
        'get_failed_invitation_attendee_ids',
        { _event_id: event_id },
      );
      if (failedErr) {
        return jsonResponse(500, { error: 'Failed to fetch failed invitations' });
      }
      const ids = (failedIds ?? []) as string[];
      if (ids.length === 0) {
        return jsonResponse(200, {
          codes_regenerated: 0,
          emails_sent: 0,
          emails_skipped: 0,
          emails_failed: 0,
          db_failed: 0,
          processed: 0,
          failed: 0,
          remaining: 0,
          next_offset: offset,
          total: 0,
          errors: [],
        });
      }
      baseSelect = baseSelect.in('id', ids);
    }

    const { data: attendees, error: attErr, count } = await baseSelect.range(
      offset,
      offset + batch_size - 1,
    );
    if (attErr) {
      return jsonResponse(500, { error: 'Failed to fetch attendees', details: attErr.message });
    }

    const total = count ?? 0;
    const rows = (attendees ?? []) as AttendeeRow[];

    if (rows.length === 0) {
      return jsonResponse(200, {
        codes_regenerated: 0,
        emails_sent: 0,
        emails_skipped: 0,
        emails_failed: 0,
        db_failed: 0,
        processed: 0,
        failed: 0,
        remaining: 0,
        next_offset: offset,
        total,
        errors: [],
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const eventLoginUrl = buildEventUrl(event.event_code);
    const eventDates = formatEventDateRange(event.start_date, event.end_date, 'es');

    // FIX: previous version used double-escaped \\s and \\. which never matched
    // any valid email — every send was incorrectly skipped as invalid_email.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Granular counters: separate DB updates from email outcomes so the UI
    // can show "X codes regenerated, Y emails sent, Z failed, W skipped".
    let codes_regenerated = 0;
    let emails_sent = 0;
    let emails_skipped = 0;
    let emails_failed = 0;
    let db_failed = 0;
    const errors: { attendee_id: string; reason: string }[] = [];

    for (const a of rows) {
      try {
        const plainCode = generateCode(8);
        const salt = bcrypt.genSaltSync(BCRYPT_COST);
        const hash = bcrypt.hashSync(plainCode, salt);

        const { error: updErr } = await supabaseAdmin
          .from('attendees')
          .update({
            access_code_hash: hash,
            access_code_lookup: plainCode.substring(0, 4).toUpperCase(),
            invitation_sent_at: new Date().toISOString(),
            last_session_id: null,
          })
          .eq('id', a.id);

        if (updErr) {
          db_failed++;
          errors.push({ attendee_id: a.id, reason: `db_error: ${updErr.message}` });
          try {
            await supabaseAdmin.from('invitation_send_log').insert({
              attendee_id: a.id,
              event_id,
              status: 'failed',
              reason: 'db_error',
              error_message: updErr.message,
              attempted_by: userId,
            });
          } catch { /* ignore */ }
          continue;
        }

        codes_regenerated++;

        const skipEmail =
          !send_email ||
          !resendApiKey ||
          !a.email ||
          !EMAIL_RE.test(a.email.trim());

        if (skipEmail) {
          emails_skipped++;
          if (send_email && (!a.email || !EMAIL_RE.test((a.email ?? '').trim()))) {
            try {
              await supabaseAdmin.from('invitation_send_log').insert({
                attendee_id: a.id,
                event_id,
                status: 'skipped',
                reason: 'invalid_email',
                attempted_by: userId,
              });
            } catch { /* ignore */ }
          }
          continue;
        }

        const { html, text, subject } = buildInvitationEmail({
          attendeeName: escapeHtml(a.full_name),
          eventName: event.name,
          accessCode: plainCode,
          loginUrl: eventLoginUrl,
          eventDates: eventDates || undefined,
          eventVenue: event.venue_name || undefined,
        });

        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Health Plus Travels Events <noreply@healtplustravels.app>',
            to: [a.email],
            subject,
            html,
            text,
          }),
        });

        if (resendResp.ok) {
          emails_sent++;
          try {
            await supabaseAdmin.from('invitation_send_log').insert({
              attendee_id: a.id,
              event_id,
              status: 'sent',
              attempted_by: userId,
            });
          } catch { /* ignore */ }
        } else {
          emails_failed++;
          let reason = 'resend_error';
          if (resendResp.status === 429) reason = 'rate_limited';
          let errBody = '';
          try { errBody = JSON.stringify(await resendResp.json()); } catch { /* ignore */ }
          errors.push({
            attendee_id: a.id,
            reason: `email_${reason}: HTTP ${resendResp.status} ${errBody}`,
          });
          try {
            await supabaseAdmin.from('invitation_send_log').insert({
              attendee_id: a.id,
              event_id,
              status: 'failed',
              reason,
              error_message: `Resend ${resendResp.status}: ${errBody}`,
              attempted_by: userId,
            });
          } catch { /* ignore */ }
        }

        await sleep(EMAIL_DELAY_MS);
      } catch (err) {
        db_failed++;
        errors.push({ attendee_id: a.id, reason: `exception: ${(err as Error).message}` });
      }
    }

    const next_offset = offset + rows.length;
    const remaining = Math.max(0, total - next_offset);

    // Backwards-compatible derived fields:
    // - processed = total rows handled (DB update succeeded OR failed)
    // - failed    = email failures + db failures (anything that produced an error)
    const processed = codes_regenerated + db_failed;
    const failed = emails_failed + db_failed;

    return jsonResponse(200, {
      // New granular metrics
      codes_regenerated,
      emails_sent,
      emails_skipped,
      emails_failed,
      db_failed,
      // Legacy fields (kept for backwards compatibility)
      processed,
      failed,
      remaining,
      next_offset,
      total,
      errors,
    });
  } catch (err) {
    console.error('bulk-regenerate-access-codes unexpected error:', err);
    return jsonResponse(500, { error: 'Server error' });
  }
});
