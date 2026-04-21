import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBaseUrl } from "../_shared/build-event-url.ts";
import { renderEmail, renderEmailText, codeBlock, escapeHtml } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, data?: unknown) => {
  console.log(`[invite-provider] ${step}`, data !== undefined ? JSON.stringify(data) : "");
};

const errorResponse = (status: number, error: string, details?: unknown) =>
  new Response(JSON.stringify({ error, ...(details ? { details } : {}) }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sendInviteEmail(
  email: string,
  inviteLink: string,
  resendApiKey: string,
  accessCode?: string | null,
  eventName?: string | null,
): Promise<void> {
  const eventLabel = eventName?.trim() || 'Health Plus Travels Events';
  const body = accessCode ? codeBlock(accessCode, 'Tu código de acceso interno') : '';
  const opts = {
    preheader: `Acceso a tu portal de proveedor — ${eventLabel}`,
    eyebrow: '🤝 Portal de Proveedores',
    headline: 'Bienvenido al portal de proveedores',
    intro: `Has sido invitado/a a acceder al <strong>portal de proveedores</strong> de <strong>${escapeHtml(eventLabel)}</strong>. Configura tu acceso con el botón de abajo.`,
    body,
    ctaLabel: 'Acceder al portal',
    ctaUrl: inviteLink,
    ctaUrlHint: true,
    footerNote: 'Este enlace expira en 24 horas. Si no esperabas este correo, puedes ignorarlo.',
    eventName: eventLabel,
  };
  const html = renderEmail(opts);
  const text = renderEmailText({ ...opts, code: accessCode ?? undefined, codeLabel: 'Código interno' });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Health Plus Travels Events <noreply@healtplustravels.app>",
      to: [email],
      subject: `🤝 ${eventLabel} — Acceso al portal de proveedor`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend error (${response.status}): ${errorBody}`);
  }
}

/**
 * Look up an auth user by email across pages of listUsers().
 * Limited to 5 pages × 200 users = 1000 max for snappy responses.
 */
async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<any | null> {
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 5; page++) {
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      log("missing-secret", "RESEND_API_KEY");
      return errorResponse(500, "RESEND_API_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse(401, "Unauthorized");

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      log("auth-failed", authError?.message);
      return errorResponse(401, "Unauthorized");
    }

    const { data: roles, error: rolesError } = await anonClient.rpc("get_user_roles", { _user_id: caller.id });
    if (rolesError) {
      log("roles-error", rolesError.message);
      return errorResponse(403, "Failed to read roles", rolesError.message);
    }
    const isAdmin = (roles ?? []).some((r: string) => ["superuser", "admin"].includes(r));
    if (!isAdmin) return errorResponse(403, "Forbidden");

    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "Invalid JSON body");
    }
    const { provider_id, email: rawEmail, event_id, redirect_to, action } = body ?? {};

    if (!provider_id || !rawEmail || !event_id) {
      return errorResponse(400, "Missing required fields: provider_id, email, event_id");
    }

    const email = String(rawEmail).trim().toLowerCase();
    log("start", { provider_id, email, event_id, action });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const baseUrl = buildBaseUrl();
    const sanitizedRedirect = (redirect_to ?? "").toString().replace(/\/+$/, "");
    const redirectUrl = sanitizedRedirect || (baseUrl ? `${baseUrl}/provider` : `${supabaseUrl}/provider`);

    // Use maybeSingle to avoid silent failure
    const { data: provider, error: providerError } = await adminClient
      .from("providers")
      .select("user_id, contact_email, access_code")
      .eq("id", provider_id)
      .maybeSingle();
    if (providerError) {
      log("provider-fetch-error", providerError.message);
      return errorResponse(500, "Failed to fetch provider", providerError.message);
    }
    if (!provider) {
      return errorResponse(404, "Provider not found");
    }
    const accessCode = (provider as any)?.access_code ?? null;

    const { data: eventInfo, error: eventError } = await adminClient
      .from("events")
      .select("name, organization_id")
      .eq("id", event_id)
      .maybeSingle();
    if (eventError) {
      log("event-fetch-error", eventError.message);
      return errorResponse(500, "Failed to fetch event", eventError.message);
    }
    if (!eventInfo) {
      return errorResponse(404, "Event not found");
    }
    const eventName = (eventInfo as any)?.name ?? null;
    const eventData = eventInfo as { name: string; organization_id: string };

    // === ACTION: reinvite ===
    if (action === "reinvite" && provider?.user_id) {
      log("reinvite-deleting-user", provider.user_id);
      const { error: delErr } = await adminClient.auth.admin.deleteUser(provider.user_id);
      if (delErr) {
        log("reinvite-delete-error", delErr.message);
        return errorResponse(500, "Failed to delete previous user", delErr.message);
      }
      await adminClient
        .from("providers")
        .update({ user_id: null, last_login: null, login_count: 0, password_changed: false })
        .eq("id", provider_id);
    }

    // === ACTION: resend ===
    if (action === "resend" && provider?.user_id) {
      log("resend-generate-link");
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: redirectUrl },
      });

      if (linkError || !linkData?.properties?.action_link) {
        log("resend-link-error", linkError?.message);
        return errorResponse(400, linkError?.message ?? "Failed to generate link");
      }

      try {
        await sendInviteEmail(email, linkData.properties.action_link, resendApiKey, accessCode, eventName);
      } catch (emailErr: any) {
        log("resend-email-error", emailErr?.message);
        return errorResponse(502, "Failed to send email", emailErr?.message);
      }

      log("resend-success");
      return new Response(
        JSON.stringify({ success: true, action: "resent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === INVITE: nuevo proveedor ===
    const linkExistingUser = async (userId: string) => {
      log("link-existing-user", userId);
      await adminClient.from("profiles").upsert({ id: userId, email, full_name: `Provider: ${email}` });
      await adminClient.from("user_roles").upsert(
        { user_id: userId, role: "provider", organization_id: eventData.organization_id, assigned_by: caller.id },
        { onConflict: "user_id,role" }
      );
      await adminClient.from("providers").update({ user_id: userId }).eq("id", provider_id);

      const { data: magicData, error: magicError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: redirectUrl },
      });

      if (magicError || !magicData?.properties?.action_link) {
        log("link-magic-error", magicError?.message);
        throw new Error(magicError?.message ?? "Failed to generate magic link");
      }
      await sendInviteEmail(email, magicData.properties.action_link, resendApiKey, accessCode, eventName);
    };

    log("generating-invite-link");
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

      log("invite-error", { msg: inviteError.message, isAlreadyRegistered });

      if (isAlreadyRegistered) {
        const existingUser = await findAuthUserByEmail(adminClient, email);

        if (existingUser?.id) {
          try {
            await linkExistingUser(existingUser.id);
            log("linked-existing-success");
            return new Response(
              JSON.stringify({ success: true, user_id: existingUser.id, action: "linked_existing" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } catch (linkErr: any) {
            log("link-existing-error", linkErr?.message);
            return errorResponse(500, "Failed to link existing user", linkErr?.message);
          }
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

      return errorResponse(400, inviteError.message);
    }

    const userId = inviteData.user.id;
    const inviteLink = inviteData.properties?.action_link;
    if (!inviteLink) {
      log("missing-invite-link");
      return errorResponse(500, "Invite generated but action_link missing");
    }

    await adminClient.from("profiles").upsert({ id: userId, email, full_name: `Provider: ${email}` });
    await adminClient.from("user_roles").insert({
      user_id: userId, role: "provider", organization_id: eventData.organization_id, assigned_by: caller.id,
    });
    await adminClient.from("providers").update({ user_id: userId }).eq("id", provider_id);

    try {
      await sendInviteEmail(email, inviteLink, resendApiKey, accessCode, eventName);
    } catch (emailErr: any) {
      log("invite-email-error", emailErr?.message);
      // user is created; surface a 207-style partial success
      return new Response(
        JSON.stringify({ success: true, user_id: userId, action: "invited", warning: "User created but email delivery failed", details: emailErr?.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("invite-success", userId);
    return new Response(
      JSON.stringify({ success: true, user_id: userId, action: "invited" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[invite-provider] unhandled", err?.message, err?.stack);
    return errorResponse(500, err?.message ?? "Internal error");
  }
});
