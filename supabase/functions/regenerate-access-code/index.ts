import { createClient } from 'npm:@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { buildEventUrl } from '../_shared/build-event-url.ts';
import {
  renderEmail,
  renderEmailText,
  codeBlock,
  formatEventDateRange,
  escapeHtml,
} from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const requestSchema = z.object({
  attendee_id: z.string().uuid(),
  send_email: z.boolean().optional().default(false),
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

function buildRegenEmail(params: {
  attendeeName: string;
  eventName: string;
  accessCode: string;
  loginUrl: string;
  eventDates?: string;
  eventVenue?: string;
}) {
  const { attendeeName, eventName, accessCode, loginUrl, eventDates, eventVenue } = params;
  const opts = {
    preheader: 'Tu código anterior ya no es válido. Aquí está el nuevo.',
    eyebrow: '🔐 Nuevo código de acceso',
    headline: `Hola ${attendeeName}, tu código fue regenerado`,
    intro:
      'El organizador del evento ha generado un <strong>nuevo código de acceso</strong> para ti. Tu código anterior ya no funciona — usa el siguiente para entrar a la app.',
    body: codeBlock(accessCode, 'Tu nuevo código de acceso'),
    ctaLabel: 'Entrar al evento',
    ctaUrl: loginUrl,
    ctaUrlHint: true,
    footerNote:
      'Si no solicitaste este cambio, contacta de inmediato al organizador del evento.',
    eventName,
    eventDates,
    eventVenue,
  };
  return {
    html: renderEmail(opts),
    text: renderEmailText({ ...opts, code: accessCode, codeLabel: 'Nuevo código' }),
    subject: `🔐 ${eventName} — Nuevo código de acceso`,
  };
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

    const { attendee_id, send_email } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: attendee, error: aErr } = await supabaseAdmin
      .from('attendees')
      .select('id, full_name, email, event_id')
      .eq('id', attendee_id)
      .is('deleted_at', null)
      .single();

    if (aErr || !attendee) {
      return jsonResponse(404, { error: 'Attendee not found' });
    }

    // Generate new code + bcrypt hash
    const plainCode = generateCode(8);
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(plainCode, salt);

    const { error: updateError } = await supabaseAdmin
      .from('attendees')
      .update({
        access_code_hash: hash,
        invitation_sent_at: new Date().toISOString(),
        last_session_id: null,
      })
      .eq('id', attendee_id);

    if (updateError) {
      console.error('Update error:', updateError.message);
      // Best-effort log
      try {
        await supabaseAdmin.from('invitation_send_log').insert({
          attendee_id,
          event_id: attendee.event_id,
          status: 'failed',
          reason: 'db_error',
          error_message: updateError.message,
          attempted_by: userId,
        });
      } catch { /* ignore */ }
      return jsonResponse(500, { error: 'Failed to update attendee' });
    }

    let emailSent = false;
    let emailReason: string | null = null;
    let emailError: string | null = null;
    if (send_email) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const { data: event } = await supabaseAdmin
          .from('events')
          .select('name, event_code, start_date, end_date, venue_name')
          .eq('id', attendee.event_id)
          .single();

        if (event) {
          const loginUrl = buildEventUrl(event.event_code);
          const eventDates = formatEventDateRange(event.start_date, event.end_date, 'es');
          const { html, text, subject } = buildRegenEmail({
            attendeeName: escapeHtml(attendee.full_name),
            eventName: event.name,
            accessCode: plainCode,
            loginUrl,
            eventDates: eventDates || undefined,
            eventVenue: event.venue_name || undefined,
          });

          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Health Plus Travels Events <noreply@healtplustravels.app>',
              to: [attendee.email],
              subject,
              html,
              text,
            }),
          });
          emailSent = resendResponse.ok;
          if (!emailSent) {
            emailReason = resendResponse.status === 429 ? 'rate_limited' : 'resend_error';
            try {
              const body = await resendResponse.json();
              emailError = `Resend ${resendResponse.status}: ${JSON.stringify(body)}`;
            } catch {
              emailError = `Resend ${resendResponse.status}`;
            }
          }
        } else {
          emailReason = 'db_error';
          emailError = 'Event not found';
        }
      } else {
        emailReason = 'resend_error';
        emailError = 'RESEND_API_KEY not configured';
      }
    }

    // Audit log (best effort) — only when an email was actually attempted
    if (send_email) {
      try {
        await supabaseAdmin.from('invitation_send_log').insert({
          attendee_id,
          event_id: attendee.event_id,
          status: emailSent ? 'sent' : 'failed',
          reason: emailSent ? null : emailReason,
          error_message: emailSent ? null : emailError,
          attempted_by: userId,
        });
      } catch { /* ignore */ }
    }

    return jsonResponse(200, { success: true, access_code: plainCode, email_sent: emailSent });
  } catch (err) {
    console.error('Unexpected error:', err);
    return jsonResponse(500, { error: 'Server error' });
  }
});
