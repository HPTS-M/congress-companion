import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const nowIso = new Date().toISOString();

    // Find pending scheduled announcements whose time has come
    const { data: pending, error: fetchErr } = await admin
      .from("announcements")
      .select("id, event_id, scheduled_for")
      .is("sent_at", null)
      .not("scheduled_for", "is", null)
      .lte("scheduled_for", nowIso)
      .limit(100);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let dispatched = 0;
    const dispatchedIds: string[] = [];
    for (const ann of pending) {
      // Recalculate reach_count = confirmed attendees at dispatch time
      const { count } = await admin
        .from("attendees")
        .select("*", { count: "exact", head: true })
        .eq("event_id", ann.event_id)
        .eq("registration_status", "confirmed")
        .is("deleted_at", null);

      const { error: updErr } = await admin
        .from("announcements")
        .update({ sent_at: nowIso, reach_count: count ?? 0 })
        .eq("id", ann.id);

      if (!updErr) {
        dispatched += 1;
        dispatchedIds.push(ann.id);
      }
    }

    // Fire Web Push for every dispatched announcement (best-effort, parallel)
    if (dispatchedIds.length > 0) {
      const pushUrl = `${supabaseUrl}/functions/v1/send-announcement-push`;
      await Promise.allSettled(
        dispatchedIds.map((id) =>
          fetch(pushUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ announcement_id: id }),
          }).then((r) => r.text()),
        ),
      );
    }

    return new Response(JSON.stringify({ dispatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
