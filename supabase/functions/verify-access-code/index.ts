import { createClient } from 'npm:@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// --- Input validation schema ---
const requestSchema = z.object({
  access_code: z
    .string()
    .trim()
    .min(6, 'Invalid code')
    .max(12, 'Invalid code')
    .regex(/^[A-Za-z0-9]+$/, 'Invalid code'),
  event_code: z
    .string()
    .trim()
    .min(3, 'Invalid event')
    .max(50, 'Invalid event')
    .regex(/^[A-Za-z0-9-]+$/, 'Invalid event'),
});

// --- Rate limiting helpers ---
const RATE_LIMIT_MAX = 5;
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
    // 1. Parse & validate input
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

    const { access_code, event_code } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 2. Rate limiting
    const clientIp = getClientIp(req);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from('access_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', clientIp)
      .gte('attempted_at', windowStart);

    if (countError) {
      console.error('Rate limit check failed:', countError.message);
    }

    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return jsonError(429, 'Too many attempts. Try again later.');
    }

    // Log this attempt
    await supabaseAdmin
      .from('access_attempts')
      .insert({ ip_address: clientIp, event_code });

    // Periodic cleanup (fire-and-forget, ~1% of requests)
    if (Math.random() < 0.01) {
      supabaseAdmin.rpc('cleanup_old_attempts').then(() => {}).catch(() => {});
    }

    // 3. Find event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, event_code, start_date, end_date, venue_name, status')
      .eq('event_code', event_code)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      console.error('Event lookup error:', eventError?.message);
      return jsonError(404, 'Event not found');
    }

    // 4. Find attendee candidates for this event (need hash for bcrypt compare)
    const { data: attendees, error: attendeesError } = await supabaseAdmin
      .from('attendees')
      .select('id, full_name, email, credential_code, registration_status, user_id, event_id, access_code_hash')
      .eq('event_id', event.id)
      .is('deleted_at', null)
      .not('access_code_hash', 'is', null);

    if (attendeesError) {
      console.error('Attendee lookup error:', attendeesError.message);
      return jsonError(500, 'Server error');
    }

    // 5. Bcrypt compare against each attendee's hash
    const normalizedCode = access_code.toUpperCase().trim();
    let matchedAttendee: typeof attendees[number] | null = null;

    for (const att of (attendees || [])) {
      try {
        // Use compareSync — async compare uses Workers which are unavailable in edge runtime
        const isMatch = bcrypt.compareSync(normalizedCode, att.access_code_hash!);
        if (isMatch) {
          matchedAttendee = att;
          break;
        }
      } catch {
        // Hash format mismatch (e.g., old SHA-256 hash) — skip
        continue;
      }
    }

    if (!matchedAttendee) {
      return jsonError(401, 'Invalid code');
    }

    if (matchedAttendee.registration_status === 'cancelled') {
      return jsonError(403, 'Registration cancelled');
    }

    // Auto-confirm pending attendees on first successful login
    if (matchedAttendee.registration_status === 'pending') {
      await supabaseAdmin
        .from('attendees')
        .update({ registration_status: 'confirmed' })
        .eq('id', matchedAttendee.id);
      matchedAttendee.registration_status = 'confirmed';
    }

    // 6. Create or find auth user
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

    // 7. Generate magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: matchedAttendee.email,
    });

    if (linkError || !linkData) {
      console.error('Magic link generation failed:', linkError?.message);
      return jsonError(500, 'Server error');
    }

    const emailOtp = linkData.properties?.email_otp;

    if (!emailOtp) {
      const actionLink = linkData.properties?.action_link;
      if (!actionLink) {
        return jsonError(500, 'Server error');
      }

      const url = new URL(actionLink);
      const tokenHash = url.searchParams.get('token');

      return new Response(
        JSON.stringify({
          success: true,
          token_hash: tokenHash,
          type: 'magiclink',
          email: matchedAttendee.email,
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
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_otp: emailOtp,
        email: matchedAttendee.email,
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
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return jsonError(500, 'Server error');
  }
});
