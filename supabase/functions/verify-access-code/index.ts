import { createClient } from 'npm:@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// --- Input validation schema ---
// Accepts EITHER an access_code (bcrypt-hashed) OR an external_credential_code.
const requestSchema = z
  .object({
    access_code: z
      .string()
      .trim()
      .min(6)
      .max(12)
      .regex(/^[A-Za-z0-9]+$/)
      .optional(),
    external_credential_code: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[A-Za-z0-9_\-]+$/)
      .optional(),
    event_code: z
      .string()
      .trim()
      .min(3, 'Invalid event')
      .max(50, 'Invalid event')
      .regex(/^[A-Za-z0-9-]+$/, 'Invalid event'),
    force_login: z.boolean().optional().default(false),
  })
  .refine(
    (d) => !!d.access_code || !!d.external_credential_code,
    { message: 'Code required' },
  );

// Increased from 5 → 10 to accommodate mobile users behind CGNAT,
// where many real users may share the same egress IP.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MINUTES = 15;

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function jsonError(status: number, message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid request');
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'Invalid code');
    }

    const { access_code, external_credential_code, event_code, force_login } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- Rate limiting (composite key: ip + event_code, only failed attempts counted) ---
    const clientIp = getClientIp(req);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from('access_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', clientIp)
      .eq('event_code', event_code)
      .gte('attempted_at', windowStart);

    if (countError) {
      console.error('Rate limit check failed:', countError.message);
    }

    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return jsonError(429, 'Too many attempts. Try again later.');
    }

    // Helper: log a failed attempt only (successful logins are NOT counted).
    const logFailedAttempt = async () => {
      try {
        await supabaseAdmin
          .from('access_attempts')
          .insert({ ip_address: clientIp, event_code });
      } catch (e) {
        console.error('Failed to log attempt:', (e as Error).message);
      }
    };

    if (Math.random() < 0.01) {
      supabaseAdmin.rpc('cleanup_old_attempts').then(() => {}).catch(() => {});
    }

    // Find event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, event_code, start_date, end_date, venue_name, status, settings')
      .eq('event_code', event_code)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      console.error('Event lookup error:', eventError?.message);
      await logFailedAttempt();
      return jsonError(404, 'Event not found');
    }

    const externalEnabled =
      ((event.settings ?? {}) as Record<string, unknown>).external_credentials_enabled === true;

    let matchedAttendee: Record<string, any> | null = null;

    if (external_credential_code) {
      // External-code login path: only allowed if the toggle is enabled
      if (!externalEnabled) {
        await logFailedAttempt();
        return jsonError(401, 'Invalid code');
      }

      const normalizedExt = external_credential_code.toUpperCase().trim();
      const { data: candidates, error: extErr } = await supabaseAdmin
        .from('attendees')
        .select('id, full_name, email, credential_code, registration_status, user_id, event_id, external_credential_code, last_session_id')
        .eq('event_id', event.id)
        .is('deleted_at', null)
        .not('external_credential_code', 'is', null);

      if (extErr) {
        console.error('External code lookup error:', extErr.message);
        return jsonError(500, 'Server error');
      }

      matchedAttendee =
        (candidates || []).find(
          (a) => (a.external_credential_code || '').toUpperCase().trim() === normalizedExt,
        ) || null;
    } else if (access_code) {
      const normalizedCode = access_code.toUpperCase().trim();
      const lookupKey = normalizedCode.substring(0, 4);
      const ATTENDEE_COLUMNS =
        'id, full_name, email, credential_code, registration_status, user_id, event_id, access_code_hash, last_session_id, access_code_lookup';

      // ---- FAST PATH: indexed lookup by first 4 chars ----
      const { data: fastCandidates, error: fastErr } = await supabaseAdmin
        .from('attendees')
        .select(ATTENDEE_COLUMNS)
        .eq('event_id', event.id)
        .eq('access_code_lookup', lookupKey)
        .is('deleted_at', null)
        .not('access_code_hash', 'is', null);

      if (fastErr) {
        console.error('Fast path lookup error:', fastErr.message);
        return jsonError(500, 'Server error');
      }

      for (const att of (fastCandidates || [])) {
        try {
          if (bcrypt.compareSync(normalizedCode, att.access_code_hash!)) {
            matchedAttendee = att;
            break;
          }
        } catch {
          continue;
        }
      }

      // ---- FALLBACK PATH: paginated scan over un-cured attendees ----
      // Only attendees missing access_code_lookup (legacy data, pre-deploy).
      if (!matchedAttendee) {
        const PAGE_SIZE = 100;
        let from = 0;
        // Hard cap iterations to avoid runaway loops if DB grows unexpectedly.
        const MAX_PAGES = 20;
        for (let page = 0; page < MAX_PAGES; page++) {
          const { data: legacy, error: legacyErr } = await supabaseAdmin
            .from('attendees')
            .select(ATTENDEE_COLUMNS)
            .eq('event_id', event.id)
            .is('deleted_at', null)
            .is('access_code_lookup', null)
            .not('access_code_hash', 'is', null)
            .range(from, from + PAGE_SIZE - 1);

          if (legacyErr) {
            console.error('Fallback path lookup error:', legacyErr.message);
            return jsonError(500, 'Server error');
          }

          if (!legacy || legacy.length === 0) break;

          for (const att of legacy) {
            try {
              if (bcrypt.compareSync(normalizedCode, att.access_code_hash!)) {
                matchedAttendee = att;
                break;
              }
            } catch {
              continue;
            }
          }

          if (matchedAttendee) break;
          if (legacy.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }

        // Auto-cure: backfill access_code_lookup so next login uses fast path.
        if (matchedAttendee) {
          try {
            await supabaseAdmin
              .from('attendees')
              .update({ access_code_lookup: lookupKey })
              .eq('id', matchedAttendee.id);
          } catch (e) {
            console.error('Auto-cure failed (non-fatal):', (e as Error).message);
          }
        }
      }
    }

    if (!matchedAttendee) {
      await logFailedAttempt();
      return jsonError(401, 'Invalid code');
    }

    if (matchedAttendee.registration_status === 'cancelled') {
      await logFailedAttempt();
      return jsonError(403, 'Registration cancelled');
    }

    // Block if session already active unless force_login is set
    if (matchedAttendee.last_session_id) {
      if (!force_login) {
        // Conflict is not a fraudulent attempt — do not count toward rate limit.
        return jsonError(409, 'Session already active');
      }
      await supabaseAdmin
        .from('attendees')
        .update({ last_session_id: null })
        .eq('id', matchedAttendee.id);
    }

    // Auto-confirm pending attendees on first successful login
    if (matchedAttendee.registration_status === 'pending') {
      await supabaseAdmin
        .from('attendees')
        .update({ registration_status: 'confirmed' })
        .eq('id', matchedAttendee.id);
      matchedAttendee.registration_status = 'confirmed';
    }

    // Create or find auth user
    let userId = matchedAttendee.user_id;

    if (!userId) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: matchedAttendee.email,
        email_confirm: true,
        user_metadata: {
          full_name: matchedAttendee.full_name,
          attendee_id: matchedAttendee.id,
          event_id: event.id,
        },
      });

      if (createError) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', matchedAttendee.email)
          .single();

        if (profile) {
          userId = profile.id;
        } else {
          console.error('User creation failed:', createError.message);
          return jsonError(500, 'Server error');
        }
      } else {
        userId = newUser.user.id;
      }

      await supabaseAdmin
        .from('attendees')
        .update({ user_id: userId })
        .eq('id', matchedAttendee.id);

      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'attendee', is_active: true })
        .select()
        .maybeSingle();
    }

    // --- Generate magic link ---
    // We ALWAYS extract token_hash from action_link (universal, PKCE-compatible)
    // and OPTIONALLY include email_otp when Supabase emits it (legacy fallback).
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: matchedAttendee.email,
    });

    if (linkError || !linkData) {
      console.error('Magic link generation failed:', linkError?.message);
      return jsonError(500, 'Server error');
    }

    const sessionMarker = crypto.randomUUID();
    await supabaseAdmin
      .from('attendees')
      .update({ last_session_id: sessionMarker })
      .eq('id', matchedAttendee.id);

    // Extract token_hash (modern, universal path — works on mobile + desktop).
    // Prefer hashed_token property; fall back to parsing action_link query string.
    let tokenHash: string | null =
      (linkData.properties as Record<string, any> | undefined)?.hashed_token ?? null;

    if (!tokenHash) {
      const actionLink = linkData.properties?.action_link;
      if (actionLink) {
        try {
          const url = new URL(actionLink);
          tokenHash = url.searchParams.get('token');
        } catch (e) {
          console.error('Failed to parse action_link:', (e as Error).message);
        }
      }
    }

    const emailOtp = linkData.properties?.email_otp || null;

    // Must have at least one verification mechanism
    if (!tokenHash && !emailOtp) {
      console.error('Neither token_hash nor email_otp returned by generateLink');
      return jsonError(500, 'Server error');
    }

    const responsePayload: Record<string, any> = {
      success: true,
      email: matchedAttendee.email,
      session_marker: sessionMarker,
      type: 'magiclink',
      attendee: {
        id: matchedAttendee.id,
        full_name: matchedAttendee.full_name,
        credential_code: matchedAttendee.credential_code,
        registration_status: matchedAttendee.registration_status,
        event_id: matchedAttendee.event_id,
      },
      event: {
        id: event.id,
        name: event.name,
        event_code: event.event_code,
        start_date: event.start_date,
        end_date: event.end_date,
        venue_name: event.venue_name,
      },
    };

    if (tokenHash) responsePayload.token_hash = tokenHash;
    if (emailOtp) responsePayload.email_otp = emailOtp;

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return jsonError(500, 'Server error');
  }
});
