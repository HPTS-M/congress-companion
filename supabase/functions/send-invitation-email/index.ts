import { createClient } from 'npm:@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { buildEventUrl } from '../_shared/build-event-url.ts';
import {
  renderEmail,
  renderEmailText,
  codeBlock,
  stepList,
  formatEventDateRange,
  escapeHtml,
} from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// CAP per request lowered from 200 → 50.
// The frontend service auto-paginates large selections in chunks of 50.
// This guarantees we stay well under the 60s edge function timeout even
// with retries and Resend rate limiting.
const MAX_PER_REQUEST = 50;

// Bcrypt cost 8 (was 10): ~80ms per hash vs ~300ms.
// Still secure for short-lived custom auth codes (2^8 = 256 rounds).
const BCRYPT_COST = 8;

// Process attendees in chunks of N concurrently using Promise.allSettled,
// so a single failure (DB or Resend) never blocks the rest of the batch.
const CHUNK_SIZE = 20;

// Retry policy for Resend transient errors (429, 5xx)
const RETRY_DELAYS_MS = [500, 1500, 4000];

const requestSchema = z.object({
  attendee_ids: z.array(z.string().uuid()).min(1).max(MAX_PER_REQUEST),
  event_id: z.string().uuid(),
});

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion

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

type FailureReason =
  | 'rate_limited'
  | 'invalid_recipient'
  | 'resend_error'
  | 'db_error'
  | 'unknown';

function classifyResendError(status: number, errBody: unknown): FailureReason {
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'resend_error';
  // 422 / 400: invalid recipient (bad domain, mailbox blocked, etc.)
  const message = JSON.stringify(errBody ?? {}).toLowerCase();
  if (
    message.includes('invalid') ||
    message.includes('bounce') ||
    message.includes('does not exist') ||
    message.includes('not allowed')
  ) {
    return 'invalid_recipient';
  }
  return 'resend_error';
}

interface InvitationEmailContent {
  html: string;
  text: string;
  subject: string;
}

function buildInvitationEmail(params: {
  attendeeName: string;
  eventName: string;
  accessCode: string;
  loginUrl: string;
  eventDates?: string;
  eventVenue?: string;
}): InvitationEmailContent {
  const { attendeeName, eventName, accessCode, loginUrl, eventDates, eventVenue } = params;

  const steps = [
    'Toca el botón <strong>"Entrar al evento"</strong> que aparece más abajo.',
    'Ingresa tu <strong>código personal de 8 caracteres</strong>.',
    'También puedes escanear el QR de tu credencial desde la app.',
  ];

  const body = codeBlock(accessCode, 'Tu código de acceso') + stepList('Cómo entrar', steps);

  const opts = {
    preheader: `Tu código personal para entrar a ${eventName}${eventDates ? ' — ' + eventDates : ''}`,
    eyebrow: '🎫 Tu acceso al congreso',
    headline: `Hola ${attendeeName}, ¡bienvenido/a a ${eventName}!`,
    intro: `Has sido registrado/a oficialmente. A continuación tienes tu código personal para acceder a la app del evento.`,
    body,
    ctaLabel: 'Entrar al evento',
    ctaUrl: loginUrl,
    ctaUrlHint: true,
    footerNote: 'Este código es personal e intransferible. Si no esperabas este correo, contacta al organizador.',
    eventName,
    eventDates,
    eventVenue,
  };

  return {
    html: renderEmail(opts),
    text: renderEmailText({ ...opts, code: accessCode, codeLabel: 'Código de acceso', steps }),
    subject: `🎫 ${eventName} — Tu acceso al congreso`,
  };
}

interface SendResult {
  attendeeId: string;
  ok: boolean;
  reason?: FailureReason;
  errorMessage?: string;
  retries?: number;
}

async function logInvitationAttempt(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    attendeeId: string;
    eventId: string;
    status: 'sent' | 'failed' | 'skipped';
    reason?: string | null;
    errorMessage?: string | null;
    retries?: number;
    attemptedBy?: string | null;
  },
): Promise<void> {
  try {
    await supabaseAdmin.from('invitation_send_log').insert({
      attendee_id: params.attendeeId,
      event_id: params.eventId,
      status: params.status,
      reason: params.reason ?? null,
      error_message: params.errorMessage ?? null,
      retries: params.retries ?? 0,
      attempted_by: params.attemptedBy ?? null,
    });
  } catch (e) {
    // Logging is best-effort: never fail an invitation because the audit log fails
    console.error('[invitation_log] insert failed', (e as Error).message);
  }
}

async function sendOneInvitation(
  attendee: { id: string; full_name: string; email: string },
  event: { id: string; name: string; event_code: string; start_date?: string | null; end_date?: string | null; venue_name?: string | null },
  eventLoginUrl: string,
  resendApiKey: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  attemptedBy: string | null,
): Promise<SendResult> {
  // 1) Generate + hash code
  const plainCode = generateCode(8);
  let hash: string;
  try {
    const salt = bcrypt.genSaltSync(BCRYPT_COST);
    hash = bcrypt.hashSync(plainCode, salt);
  } catch (err) {
    console.log('[send-invitation]', JSON.stringify({
      attendee_id: attendee.id,
      email: attendee.email,
      status: 'failed',
      reason: 'db_error',
      stage: 'hash',
      error: (err as Error).message,
    }));
    await logInvitationAttempt(supabaseAdmin, {
      attendeeId: attendee.id,
      eventId: event.id,
      status: 'failed',
      reason: 'db_error',
      errorMessage: `hash_failed: ${(err as Error).message}`,
      attemptedBy,
    });
    return { attendeeId: attendee.id, ok: false, reason: 'db_error', errorMessage: 'hash_failed' };
  }

  // 2) Persist hash + sent_at BEFORE sending email so the credential is valid
  // even if the email gets stuck in Resend's queue.
  const { error: updateError } = await supabaseAdmin
    .from('attendees')
    .update({
      access_code_hash: hash,
      invitation_sent_at: new Date().toISOString(),
    })
    .eq('id', attendee.id);

  if (updateError) {
    console.log('[send-invitation]', JSON.stringify({
      attendee_id: attendee.id,
      email: attendee.email,
      status: 'failed',
      reason: 'db_error',
      stage: 'update',
      error: updateError.message,
    }));
    await logInvitationAttempt(supabaseAdmin, {
      attendeeId: attendee.id,
      eventId: event.id,
      status: 'failed',
      reason: 'db_error',
      errorMessage: `DB update failed: ${updateError.message}`,
      attemptedBy,
    });
    return {
      attendeeId: attendee.id,
      ok: false,
      reason: 'db_error',
      errorMessage: `DB update failed: ${updateError.message}`,
    };
  }

  // 3) Build email + send with retry/backoff on 429 / 5xx
  const eventDates = formatEventDateRange(event.start_date, event.end_date, 'es');
  const { html, text, subject } = buildInvitationEmail({
    attendeeName: escapeHtml(attendee.full_name),
    eventName: event.name,
    accessCode: plainCode,
    loginUrl: eventLoginUrl,
    eventDates: eventDates || undefined,
    eventVenue: event.venue_name || undefined,
  });

  const payload = JSON.stringify({
    from: 'Health Plus Travels Events <noreply@healtplustravels.app>',
    to: [attendee.email],
    subject,
    html,
    text,
  });

  let lastReason: FailureReason = 'unknown';
  let lastError = '';

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      if (resendResponse.ok) {
        console.log('[send-invitation]', JSON.stringify({
          attendee_id: attendee.id,
          email: attendee.email,
          status: 'sent',
          retries: attempt,
        }));
        await logInvitationAttempt(supabaseAdmin, {
          attendeeId: attendee.id,
          eventId: event.id,
          status: 'sent',
          retries: attempt,
          attemptedBy,
        });
        return { attendeeId: attendee.id, ok: true, retries: attempt };
      }

      const errBody = await resendResponse.json().catch(() => ({}));
      lastReason = classifyResendError(resendResponse.status, errBody);
      lastError = `Resend ${resendResponse.status}: ${JSON.stringify(errBody)}`;

      console.log('[send-invitation]', JSON.stringify({
        attendee_id: attendee.id,
        email: attendee.email,
        status: 'retrying',
        retry_count: attempt,
        http_status: resendResponse.status,
        reason: lastReason,
      }));

      // Don't retry on permanent failures (invalid recipient, 4xx other than 429)
      if (lastReason === 'invalid_recipient') break;
      if (resendResponse.status >= 400 && resendResponse.status < 500 && resendResponse.status !== 429) {
        break;
      }
    } catch (err) {
      lastReason = 'resend_error';
      lastError = `Network error: ${(err as Error).message}`;
      console.log('[send-invitation]', JSON.stringify({
        attendee_id: attendee.id,
        email: attendee.email,
        status: 'retrying',
        retry_count: attempt,
        reason: 'network_error',
        error: lastError,
      }));
    }

    // Wait before next attempt (if any retries remain)
    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  console.log('[send-invitation]', JSON.stringify({
    attendee_id: attendee.id,
    email: attendee.email,
    status: 'failed',
    reason: lastReason,
    error: lastError,
  }));

  await logInvitationAttempt(supabaseAdmin, {
    attendeeId: attendee.id,
    eventId: event.id,
    status: 'failed',
    reason: lastReason,
    errorMessage: lastError,
    retries: RETRY_DELAYS_MS.length,
    attemptedBy,
  });

  return {
    attendeeId: attendee.id,
    ok: false,
    reason: lastReason,
    errorMessage: lastError,
    retries: RETRY_DELAYS_MS.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth
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

    // 2. Parse + validate
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

    const { attendee_ids, event_id } = parsed.data;

    // 3. Service role client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 4. Event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, event_code, start_date, end_date, venue_name')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return jsonResponse(404, { error: 'Event not found' });
    }

    // 5. Attendees
    const { data: attendees, error: attendeesError } = await supabaseAdmin
      .from('attendees')
      .select('id, full_name, email, registration_status')
      .in('id', attendee_ids)
      .eq('event_id', event_id)
      .is('deleted_at', null);

    if (attendeesError) {
      console.error('Attendees fetch error:', attendeesError.message);
      return jsonResponse(500, { error: 'Failed to fetch attendees' });
    }

    if (!attendees || attendees.length === 0) {
      return jsonResponse(404, { error: 'No attendees found' });
    }

    // 5b. Filter ineligible recipients (defense-in-depth)
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const skippedDetails: { id: string; reason: string }[] = [];
    const eligible = attendees.filter((a) => {
      if (a.registration_status === 'cancelled') {
        skippedDetails.push({ id: a.id, reason: 'cancelled' });
        return false;
      }
      if (!a.email || !EMAIL_RE.test(a.email.trim())) {
        skippedDetails.push({ id: a.id, reason: 'invalid_email' });
        return false;
      }
      return true;
    });

    // Log skipped recipients to the audit table (best effort)
    for (const skipped of skippedDetails) {
      await logInvitationAttempt(supabaseAdmin, {
        attendeeId: skipped.id,
        eventId: event.id,
        status: 'skipped',
        reason: skipped.reason,
        attemptedBy: userId,
      });
    }

    // 6. Resend key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse(500, { error: 'RESEND_API_KEY not configured' });
    }

    const eventLoginUrl = buildEventUrl(event.event_code);

    // 7. Process eligible attendees in parallel chunks
    let sent = 0;
    let failed = 0;
    const errors: { id: string; error: string; reason: FailureReason }[] = [];

    for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
      const chunk = eligible.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((a) =>
          sendOneInvitation(a, event, eventLoginUrl, resendApiKey, supabaseAdmin, userId),
        ),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value.ok) {
            sent++;
          } else {
            failed++;
            errors.push({
              id: r.value.attendeeId,
              error: r.value.errorMessage ?? 'unknown',
              reason: r.value.reason ?? 'unknown',
            });
          }
        } else {
          // Promise itself rejected (rare — sendOneInvitation catches everything)
          failed++;
          errors.push({
            id: 'unknown',
            error: String(r.reason),
            reason: 'unknown',
          });
        }
      }
    }

    return jsonResponse(200, {
      success: true,
      sent,
      failed,
      skipped: skippedDetails.length,
      skippedDetails: skippedDetails.length > 0 ? skippedDetails : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return jsonResponse(500, { error: 'Server error' });
  }
});
