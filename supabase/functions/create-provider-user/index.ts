import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated admin
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

    // Verify caller has admin role
    const { data: roles } = await anonClient.rpc("get_user_roles", { _user_id: caller.id });
    const isAdmin = (roles ?? []).some((r: string) =>
      ["superuser", "admin"].includes(r)
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { provider_id, email, event_id, redirect_to, action } = body;

    if (!provider_id || !email || !event_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: provider_id, email, event_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if this is a resend action
    if (action === "resend") {
      // Check if user already exists
      const { data: provider } = await adminClient
        .from("providers")
        .select("user_id")
        .eq("id", provider_id)
        .single();

      if (provider?.user_id) {
        // User exists, resend invite by generating a new magic link
        const { error: resendError } = await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: {
            redirectTo: redirect_to || `${supabaseUrl}`,
          },
        });

        if (resendError) {
          return new Response(
            JSON.stringify({ error: resendError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, action: "resent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Invite user by email
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: redirect_to || `${supabaseUrl}`,
        data: {
          role: "provider",
          provider_id,
          event_id,
        },
      }
    );

    if (inviteError) {
      // If user already exists, try to link them
      if (inviteError.message?.includes("already been registered") || inviteError.message?.includes("already exists")) {
        // Look up existing user
        const { data: { users } } = await adminClient.auth.admin.listUsers();
        const existingUser = users?.find((u: any) => u.email === email);

        if (existingUser) {
          const userId = existingUser.id;

          // Create profile if not exists
          await adminClient.from("profiles").upsert({
            id: userId,
            email,
            full_name: `Provider: ${email}`,
          });

          // Get org id
          const { data: eventData } = await adminClient
            .from("events")
            .select("organization_id")
            .eq("id", event_id)
            .single();

          // Assign provider role if not exists
          await adminClient.from("user_roles").upsert(
            {
              user_id: userId,
              role: "provider",
              organization_id: eventData?.organization_id,
              assigned_by: caller.id,
            },
            { onConflict: "user_id,role" }
          );

          // Link to provider record
          await adminClient
            .from("providers")
            .update({ user_id: userId })
            .eq("id", provider_id);

          return new Response(
            JSON.stringify({ success: true, user_id: userId, action: "linked_existing" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = inviteData.user.id;

    // Create profile
    await adminClient.from("profiles").upsert({
      id: userId,
      email,
      full_name: `Provider: ${email}`,
    });

    // Get org id
    const { data: eventData } = await adminClient
      .from("events")
      .select("organization_id")
      .eq("id", event_id)
      .single();

    // Assign provider role
    await adminClient.from("user_roles").insert({
      user_id: userId,
      role: "provider",
      organization_id: eventData?.organization_id,
      assigned_by: caller.id,
    });

    // Link auth user to provider record
    await adminClient
      .from("providers")
      .update({ user_id: userId })
      .eq("id", provider_id);

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
