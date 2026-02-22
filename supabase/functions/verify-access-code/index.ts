import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Hash access code with SHA-256 for efficient DB lookup.
 * SHA-256 is appropriate here because access codes are system-generated
 * random strings (not user-chosen passwords), making rainbow table attacks
 * infeasible given the entropy of 8-char alphanumeric codes.
 */
async function hashCode(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.toUpperCase().trim());
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_code, event_code } = await req.json();

    if (!access_code || !event_code) {
      return new Response(
        JSON.stringify({ error: 'MISSING_FIELDS', message: 'access_code and event_code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Find event by event_code
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, event_code, start_date, end_date, venue_name, status')
      .eq('event_code', event_code)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'EVENT_NOT_FOUND', message: 'Evento no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Hash the access code and look up attendee
    const codeHash = await hashCode(access_code);

    const { data: attendee, error: attendeeError } = await supabaseAdmin
      .from('attendees')
      .select('id, full_name, email, credential_code, registration_status, user_id, event_id')
      .eq('event_id', event.id)
      .eq('access_code_hash', codeHash)
      .is('deleted_at', null)
      .single();

    if (attendeeError || !attendee) {
      return new Response(
        JSON.stringify({ error: 'INVALID_CODE', message: 'Código de acceso inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (attendee.registration_status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'REGISTRATION_CANCELLED', message: 'Registro cancelado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Create or find auth user
    let userId = attendee.user_id;

    if (!userId) {
      // Try to create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: attendee.email,
        email_confirm: true,
        user_metadata: {
          full_name: attendee.full_name,
          attendee_id: attendee.id,
          event_id: event.id,
        },
      });

      if (createError) {
        // User may already exist with this email — find via profiles
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', attendee.email)
          .single();

        if (profile) {
          userId = profile.id;
        } else {
          console.error('Failed to create user:', createError.message);
          return new Response(
            JSON.stringify({ error: 'AUTH_ERROR', message: 'Error al crear usuario' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        userId = newUser.user.id;
      }

      // Link auth user to attendee
      await supabaseAdmin
        .from('attendees')
        .update({ user_id: userId })
        .eq('id', attendee.id);

      // Assign attendee role (ignore if already exists)
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'attendee',
          is_active: true,
        })
        .select()
        .maybeSingle();
    }

    // 4. Generate magic link (server-side, no email sent)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: attendee.email,
    });

    if (linkError || !linkData) {
      console.error('Failed to generate link:', linkError?.message);
      return new Response(
        JSON.stringify({ error: 'SESSION_ERROR', message: 'Error al generar sesión' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract OTP from generated link properties
    const emailOtp = linkData.properties?.email_otp;

    if (!emailOtp) {
      // Fallback: parse the action link URL for token
      const actionLink = linkData.properties?.action_link;
      if (!actionLink) {
        return new Response(
          JSON.stringify({ error: 'TOKEN_ERROR', message: 'No se pudo generar token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = new URL(actionLink);
      const tokenHash = url.searchParams.get('token');

      return new Response(
        JSON.stringify({
          success: true,
          token_hash: tokenHash,
          type: 'magiclink',
          email: attendee.email,
          attendee: {
            id: attendee.id,
            full_name: attendee.full_name,
            credential_code: attendee.credential_code,
            registration_status: attendee.registration_status,
            event_id: attendee.event_id,
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
        email: attendee.email,
        attendee: {
          id: attendee.id,
          full_name: attendee.full_name,
          credential_code: attendee.credential_code,
          registration_status: attendee.registration_status,
          event_id: attendee.event_id,
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
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
