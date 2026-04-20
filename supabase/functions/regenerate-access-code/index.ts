import { createClient } from 'npm:@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { buildEventUrl } from '../_shared/build-event-url.ts';

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

function buildEmailHtml(
  attendeeName: string,
  eventName: string,
  eventCode: string,
  accessCode: string,
  loginUrl: string,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#1A56A0,#00B89F);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">🔐 New Access Code</h1>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <p style="color:#334155;font-size:16px;margin:0 0 16px;">Hello <strong>${attendeeName}</strong>,</p>
      <p style="color:#334155;font-size:14px;margin:0 0 24px;">Your access code for <strong>${eventName}</strong> has been regenerated. Use the new code below:</p>
      <div style="background:#f1f5f9;border:2px dashed #1A56A0;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
        <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Access Code</div>
        <div style="color:#1A56A0;font-size:28px;font-weight:700;letter-spacing:3px;font-family:monospace;">${accessCode}</div>
      </div>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1A56A0,#00B89F);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;">Open Event App</a>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">Your previous code is no longer valid.</p>
    </div>
  </div>
</body></html>`;
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
      return jsonResponse(500, { error: 'Failed to update attendee' });
    }

    let emailSent = false;
    if (send_email) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const { data: event } = await supabaseAdmin
          .from('events')
          .select('name, event_code')
          .eq('id', attendee.event_id)
          .single();

        if (event) {
          const loginUrl = buildEventUrl(event.event_code);
          const html = buildEmailHtml(attendee.full_name, event.name, event.event_code, plainCode, loginUrl);

          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Health Plus Travels Events <noreply@healtplustravels.app>',
              to: [attendee.email],
              subject: `🔐 New access code for ${event.name}`,
              html,
            }),
          });
          emailSent = resendResponse.ok;
        }
      }
    }

    return jsonResponse(200, { success: true, access_code: plainCode, email_sent: emailSent });
  } catch (err) {
    console.error('Unexpected error:', err);
    return jsonResponse(500, { error: 'Server error' });
  }
});
