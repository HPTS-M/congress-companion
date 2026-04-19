import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildEmailHtml(params: {
  fullName: string;
  eventName: string;
  loginUrl: string;
  assignedRoom?: string | null;
}) {
  const { fullName, eventName, loginUrl, assignedRoom } = params;
  const roomLine = assignedRoom
    ? `<p style="margin:8px 0;color:#334155;"><strong>Sala asignada:</strong> ${assignedRoom}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Acceso Staff — ${eventName}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1A56A0 0%,#00B89F 100%);padding:28px 32px;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;font-weight:700;">CONGRÉSSAPP</h1>
              <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">Health Plus Travels</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#0f172a;">
              <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1A56A0;">Hola ${fullName},</h2>
              <p style="margin:0 0 16px;line-height:1.6;color:#334155;">
                Has sido invitado/a a participar como <strong>Staff</strong> en el evento
                <strong>${eventName}</strong>. Tu rol consistirá en validar el acceso de los asistentes a las sesiones del congreso.
              </p>
              ${roomLine}
              <p style="margin:16px 0;line-height:1.6;color:#334155;">
                Para activar tu cuenta y comenzar, ingresa al portal Staff usando el siguiente enlace.
                Allí podrás definir tu contraseña personal.
              </p>
              <p style="text-align:center;margin:28px 0;">
                <a href="${loginUrl}" style="display:inline-block;background:#1A56A0;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">
                  Acceder al portal Staff
                </a>
              </p>
              <p style="margin:16px 0;line-height:1.6;color:#475569;font-size:13px;">
                Si el botón no funciona, copia y pega esta dirección en tu navegador:<br />
                <span style="color:#1A56A0;word-break:break-all;">${loginUrl}</span>
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                Si tienes alguna duda o no esperabas este correo, por favor contacta al administrador del evento.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;color:#94a3b8;font-size:12px;">
              © ${new Date().getFullYear()} CONGRÉSSAPP — Health Plus Travels
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')
    const loginUrl = `${appUrl}/${event?.event_code ?? ''}/staff`
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
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CONGRÉSSAPP <noreply@healtplustravels.app>',
            to: [email],
            subject: `Acceso al Staff de ${eventName}`,
            html: buildEmailHtml({
              fullName: full_name,
              eventName,
              loginUrl,
              assignedRoom: assigned_room ?? null,
            }),
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
