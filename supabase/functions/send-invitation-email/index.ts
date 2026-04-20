import { createClient } from 'npm:@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const requestSchema = z.object({
  attendee_ids: z.array(z.string().uuid()).min(1).max(200),
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

function buildEmailHtml(
  attendeeName: string,
  eventName: string,
  eventCode: string,
  accessCode: string,
  appUrl: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#1A56A0,#00B89F);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">🎫 Your Event Credentials</h1>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <p style="color:#334155;font-size:16px;margin:0 0 16px;">Hello <strong>${attendeeName}</strong>,</p>
      <p style="color:#334155;font-size:14px;margin:0 0 24px;">You have been registered for <strong>${eventName}</strong>. Use the following code to access the event app:</p>
      
      <div style="background:#f1f5f9;border:2px dashed #1A56A0;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
        <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Access Code</div>
        <div style="color:#1A56A0;font-size:28px;font-weight:700;letter-spacing:3px;font-family:monospace;">${accessCode}</div>
      </div>
      
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:0 0 24px;">
        <div style="color:#64748b;font-size:12px;margin:0 0 4px;">Event Code</div>
        <div style="color:#334155;font-size:16px;font-weight:600;">${eventCode}</div>
      </div>
      
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${appUrl}/${eventCode}" style="display:inline-block;background:linear-gradient(135deg,#1A56A0,#00B89F);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">Open Event App</a>
      </div>
      
      <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">This code is personal and non-transferable. Do not share it with others.</p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth: validate JWT manually
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

    // Verify admin/superuser role
    const { data: roles } = await supabaseAuth.rpc('get_user_roles', { _user_id: userId });
    const isAdmin = (roles ?? []).some((r: string) => ['superuser', 'admin'].includes(r));
    if (!isAdmin) {
      return jsonResponse(403, { error: 'Forbidden: admin role required' });
    }

    // 2. Parse & validate input
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

    // 3. Service role client for writes
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 4. Get event info
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, event_code')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return jsonResponse(404, { error: 'Event not found' });
    }

    // 5. Get attendees
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

    // 5b. Defense-in-depth: filter ineligible recipients server-side.
    // Even if the client filters these, a direct API call could bypass it.
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

    // 6. Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse(500, { error: 'RESEND_API_KEY not configured' });
    }

    const appUrl = (Deno.env.get('APP_URL') || 'https://congress-companion.vercel.app').replace(/\/+$/, '');

    // 7. Process each eligible attendee
    let sent = 0;
    let failed = 0;
    const errors: { id: string; error: string }[] = [];

    for (const attendee of eligible) {
      try {
        // Generate 8-char code
        const plainCode = generateCode(8);

        // Hash with bcrypt (sync due to edge runtime limitation)
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(plainCode, salt);

        // Update DB: set hash + invitation_sent_at
        const { error: updateError } = await supabaseAdmin
          .from('attendees')
          .update({
            access_code_hash: hash,
            invitation_sent_at: new Date().toISOString(),
          })
          .eq('id', attendee.id);

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`);
        }

        // Build and send email
        const html = buildEmailHtml(
          attendee.full_name,
          event.name,
          event.event_code,
          plainCode,
          appUrl,
        );

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Health Plus Travels Events <noreply@healtplustravels.app>',
            to: [attendee.email],
            subject: `🎫 Your credentials for ${event.name}`,
            html,
          }),
        });

        if (!resendResponse.ok) {
          const errData = await resendResponse.json();
          throw new Error(`Resend error: ${JSON.stringify(errData)}`);
        }

        sent++;
      } catch (err) {
        console.error(`Failed for attendee ${attendee.id}:`, err);
        failed++;
        errors.push({ id: attendee.id, error: (err as Error).message });
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
