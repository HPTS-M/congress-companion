import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBaseUrl } from "../_shared/build-event-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendInviteEmail(email: string, inviteLink: string, resendApiKey: string, accessCode?: string | null): Promise<void> {
  const codeBlock = accessCode
    ? `<div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:16px; margin:16px 0; text-align:center;"><p style="color:#64748B; font-size:12px; margin:0 0 6px;">Tu código de acceso interno</p><p style="color:#1A56A0; font-size:22px; font-weight:700; letter-spacing:4px; font-family:monospace; margin:0;">${accessCode}</p></div>`
    : '';
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Health Plus Travels Events <noreply@healtplustravels.app>",
      to: [email],
      subject: "Acceso a tu Portal de Proveedor — Health Plus Travels Events",
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
          <h1 style="color: #1A56A0; font-size: 24px; margin-bottom: 16px;">Bienvenido al Portal de Proveedores</h1>
          <p style="color: #334155; font-size: 16px; line-height: 1.6;">Has sido invitado a acceder al portal de proveedores de Health Plus Travels Events.</p>
          ${codeBlock}
          <p style="color: #334155; font-size: 16px; line-height: 1.6;">Haz clic en el botón para configurar tu acceso:</p>
          <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #1A56A0, #00B89F); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0;">
            Acceder al Portal
          </a>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0;">
            <p style="color: #94A3B8; font-size: 12px;">Si no esperabas este correo, puedes ignorarlo.</p>
            <p style="color: #94A3B8; font-size: 12px;">Este enlace expira en 24 horas.</p>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }
}

/**
 * Look up an auth user by email across all pages of listUsers().
 * The Admin API paginates at 50 by default; we iterate up to 20 pages (1000 users)
 * and compare emails case-insensitively to avoid false negatives.
 */
async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<any | null> {
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = (data?.users ?? []) as any[];
    const found = users.find((u) => (u.email ?? "").trim().toLowerCase() === target);
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await anonClient.rpc("get_user_roles", { _user_id: caller.id });
    const isAdmin = (roles ?? []).some((r: string) => ["superuser", "admin"].includes(r));
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { provider_id, email: rawEmail, event_id, redirect_to, action } = body;

    if (!provider_id || !rawEmail || !event_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: provider_id, email, event_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = String(rawEmail).trim().toLowerCase();

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const baseUrl = buildBaseUrl();
    const sanitizedRedirect = (redirect_to ?? "").toString().replace(/\/+$/, "");
    const redirectUrl = sanitizedRedirect || (baseUrl ? `${baseUrl}/provider` : `${supabaseUrl}/provider`);

    const { data: provider } = await adminClient
      .from("providers")
      .select("user_id, contact_email, access_code")
      .eq("id", provider_id)
      .single();
    const accessCode = (provider as any)?.access_code ?? null;

    // === ACTION: reinvite ===
    // If the provider currently has a linked user, drop it so we go through the invite path again.
    if (action === "reinvite" && provider?.user_id) {
      await adminClient.auth.admin.deleteUser(provider.user_id);
      await adminClient
        .from("providers")
        .update({ user_id: null, last_login: null, login_count: 0, password_changed: false })
        .eq("id", provider_id);
    }

    // === ACTION: resend ===
    if (action === "resend" && provider?.user_id) {
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: redirectUrl },
      });

      if (linkError || !linkData?.properties?.action_link) {
        return new Response(
          JSON.stringify({ error: linkError?.message ?? "Failed to generate link" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await sendInviteEmail(email, linkData.properties.action_link, resendApiKey, accessCode);

      return new Response(
        JSON.stringify({ success: true, action: "resent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === INVITE: nuevo proveedor ===
    const { data: eventData } = await adminClient
      .from("events")
      .select("organization_id")
      .eq("id", event_id)
      .single();

    const linkExistingUser = async (userId: string) => {
      await adminClient.from("profiles").upsert({ id: userId, email, full_name: `Provider: ${email}` });
      await adminClient.from("user_roles").upsert(
        { user_id: userId, role: "provider", organization_id: eventData?.organization_id, assigned_by: caller.id },
        { onConflict: "user_id,role" }
      );
      await adminClient.from("providers").update({ user_id: userId }).eq("id", provider_id);

      const { data: magicData, error: magicError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: redirectUrl },
      });

      if (!magicError && magicData?.properties?.action_link) {
        await sendInviteEmail(email, magicData.properties.action_link, resendApiKey, accessCode);
      }
    };

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: redirectUrl,
        data: { role: "provider", provider_id, event_id },
      },
    });

    if (inviteError) {
      const msg = (inviteError.message ?? "").toLowerCase();
      const isAlreadyRegistered =
        msg.includes("already been registered") ||
        msg.includes("already exists") ||
        msg.includes("already registered");

      if (isAlreadyRegistered) {
        const existingUser = await findAuthUserByEmail(adminClient, email);

        if (existingUser?.id) {
          await linkExistingUser(existingUser.id);
          return new Response(
            JSON.stringify({ success: true, user_id: existingUser.id, action: "linked_existing" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            error: "USER_EXISTS_NOT_FOUND",
            message:
              "El correo ya está registrado en el sistema pero no se pudo localizar la cuenta automáticamente. Cambia el email del proveedor y vuelve a invitar, o contacta soporte.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = inviteData.user.id;
    const inviteLink = inviteData.properties?.action_link;

    await adminClient.from("profiles").upsert({ id: userId, email, full_name: `Provider: ${email}` });
    await adminClient.from("user_roles").insert({
      user_id: userId, role: "provider", organization_id: eventData?.organization_id, assigned_by: caller.id,
    });
    await adminClient.from("providers").update({ user_id: userId }).eq("id", provider_id);

    await sendInviteEmail(email, inviteLink, resendApiKey, accessCode);

    return new Response(
      JSON.stringify({ success: true, user_id: userId, action: "invited" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
