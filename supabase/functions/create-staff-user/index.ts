import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildEventUrl } from '../_shared/build-event-url.ts'
import { renderEmail, renderEmailText, infoCard, escapeHtml } from '../_shared/email-templates.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildStaffEmail(params: {
  fullName: string;
  eventName: string;
  loginUrl: string;
  assignedRoom?: string | null;
}) {
  const { fullName, eventName, loginUrl, assignedRoom } = params;
  const body =
    (assignedRoom ? infoCard('Sala asignada', assignedRoom) : '') +
    `<p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">Para activar tu cuenta, ingresa al portal Staff con el botón de abajo. Allí podrás definir tu contraseña personal.</p>`;
  const opts = {
    preheader: `Acceso al portal Staff de ${eventName}`,
    eyebrow: '👥 Acceso Staff',
    headline: `Hola ${fullName}, has sido invitado/a como Staff`,
    intro: `Participarás como <strong>Staff</strong> en <strong>${escapeHtml(eventName)}</strong>. Tu rol será validar el acceso de los asistentes a las sesiones del congreso.`,
    body,
    ctaLabel: 'Acceder al portal Staff',
    ctaUrl: loginUrl,
    ctaUrlHint: true,
    footerNote: 'Si no esperabas este correo, contacta al administrador del evento.',
    eventName,
  };
  return {
    html: renderEmail(opts),
    text: renderEmailText(opts),
    subject: `👥 ${eventName} — Acceso Staff`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token)
    if (!caller) throw new Error('Unauthorized')

    const body = await req.json()
    const { email, full_name, event_id, assigned_room, access_expires_at, action } = body

    if (!email || !full_name || !event_id) {
      throw new Error('Faltan campos obligatorios: email, full_name, event_id')
    }

    const { data: roles } = await supabaseAdmin.rpc('get_user_roles', { _user_id: caller.id })
    const isAdmin = roles?.some((r: string) => ['superuser', 'admin', 'coordinator'].includes(r))
    if (!isAdmin) throw new Error('Permisos insuficientes')

    // Get event for redirect link & email subject
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('organization_id, event_code, name')
      .eq('id', event_id)
      .single()

    const loginUrl = event?.event_code
      ? `${buildEventUrl(event.event_code)}/staff`
      : `${(Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')}/staff`
    const eventName = event?.name ?? 'el evento'

    if (action === 'reinvite') {
      const { data: staffRecord } = await supabaseAdmin
        .from('staff_members')
        .select('user_id')
        .eq('event_id', event_id)
        .eq('contact_email', email)
        .maybeSingle()

      if (staffRecord?.user_id) {
        await supabaseAdmin.auth.admin.deleteUser(staffRecord.user_id)
      }
    }

    let userId: string
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name, role: 'staff' },
        redirectTo: loginUrl,
      }
    )

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existing = users?.find((u: { email?: string }) => u.email === email)
        if (!existing) throw new Error('El usuario existe pero no se pudo encontrar')
        userId = existing.id
      } else {
        throw authError
      }
    } else {
      userId = authData.user.id
    }

    if (event) {
      await supabaseAdmin
        .from('profiles')
        .update({ organization_id: event.organization_id, full_name })
        .eq('id', userId)
    }

    await supabaseAdmin.from('user_roles').upsert({
      user_id: userId,
      role: 'field_manager',
      organization_id: event?.organization_id,
      is_active: true,
    }, { onConflict: 'user_id,role' })

    await supabaseAdmin.from('event_staff').upsert({
      event_id,
      user_id: userId,
      role: 'checkin_staff',
      is_active: true,
    }, { onConflict: 'event_id,user_id' })

    await supabaseAdmin
      .from('staff_members')
      .update({
        user_id: userId,
        invitation_status: 'active',
        is_active: true,
      })
      .eq('event_id', event_id)
      .eq('contact_email', email)

    // Send branded Spanish notification email via Resend (best effort)
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      try {
        const { html, text, subject } = buildStaffEmail({
          fullName: full_name,
          eventName,
          loginUrl,
          assignedRoom: assigned_room ?? null,
        });
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Health Plus Travels Events <noreply@healtplustravels.app>',
            to: [email],
            subject,
            html,
            text,
          }),
        })
      } catch (e) {
        console.error('Resend notification failed', e)
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId, email, loginUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
