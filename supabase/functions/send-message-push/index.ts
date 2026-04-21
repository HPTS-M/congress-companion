// Sends a Web Push notification to the recipient of a direct chat message.
// Invoked fire-and-forget from the frontend right after a successful insert.
//
// Privacy:
//  - Reads ONLY the subscriptions of the resolved recipient user_id.
//  - Does not log message content (only ids/status).
//
// Behavior:
//  - Skips notification if conversation is not 'active' (pending invites are
//    handled by the in-app badge — no push).
//  - Skips if sender_id == recipient_attendee_id (defensive, should not happen).
//  - Cleans expired subscriptions (HTTP 404/410).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  message_id: z.string().uuid(),
});

interface SubscriptionRow {
  id: string;
  user_id: string;
  subscription_json: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const { message_id } = parsed.data;

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPublic || !vapidPrivate || !vapidSubject) {
      return json({ error: "vapid_not_configured" }, 500);
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ---- Load message
    const { data: msg, error: msgErr } = await admin
      .from("chat_messages")
      .select("id, conversation_id, sender_id, content")
      .eq("id", message_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (msgErr) return json({ error: msgErr.message }, 500);
    if (!msg) return json({ error: "message_not_found" }, 404);

    // ---- Load conversation (must be a direct + active chat)
    const { data: conv, error: convErr } = await admin
      .from("chat_conversations")
      .select(
        "id, event_id, conversation_type, status, initiated_by, participant_id",
      )
      .eq("id", msg.conversation_id)
      .maybeSingle();

    if (convErr) return json({ error: convErr.message }, 500);
    if (!conv) return json({ error: "conversation_not_found" }, 404);

    if (conv.conversation_type !== "direct") {
      return json({ skipped: "not_direct" });
    }
    if (conv.status !== "active") {
      return json({ skipped: "not_active" });
    }

    // ---- Resolve recipient = the participant that is NOT the sender
    const recipientAttendeeId =
      conv.initiated_by === msg.sender_id
        ? conv.participant_id
        : conv.initiated_by;

    if (!recipientAttendeeId || recipientAttendeeId === msg.sender_id) {
      return json({ skipped: "no_recipient" });
    }

    // ---- Resolve recipient user_id + sender display name (parallel)
    const [recipientRes, senderRes, eventRes] = await Promise.all([
      admin
        .from("attendees")
        .select("id, user_id")
        .eq("id", recipientAttendeeId)
        .maybeSingle(),
      admin
        .from("attendees")
        .select("id, full_name")
        .eq("id", msg.sender_id)
        .maybeSingle(),
      admin
        .from("events")
        .select("id, event_code")
        .eq("id", conv.event_id)
        .maybeSingle(),
    ]);

    if (recipientRes.error) return json({ error: recipientRes.error.message }, 500);
    if (!recipientRes.data?.user_id) {
      return json({ skipped: "recipient_no_auth_user" });
    }

    const recipientUserId = recipientRes.data.user_id;
    const senderName = senderRes.data?.full_name ?? "Mensaje";
    const eventCode = eventRes.data?.event_code ?? "";
    const targetUrl = eventCode ? `/${eventCode}/messaging` : "/messaging";

    // ---- Load only this recipient's subscriptions for this event
    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, user_id, subscription_json")
      .eq("user_id", recipientUserId)
      .eq("event_id", conv.event_id);

    if (subsErr) return json({ error: subsErr.message }, 500);
    if (!subs || subs.length === 0) {
      return json({ sent: 0, failed: 0, expired: 0, total: 0 });
    }

    // ---- Build payload (≤ ~3KB safe limit)
    const body = String(msg.content ?? "").slice(0, 140);
    const payload = JSON.stringify({
      title: senderName,
      body,
      url: targetUrl,
      tag: `dm-${conv.id}`, // groups consecutive messages of the same conversation
    });

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    for (const row of subs as SubscriptionRow[]) {
      try {
        await webpush.sendNotification(row.subscription_json as any, payload);
        sent += 1;
      } catch (err: any) {
        const status = err?.statusCode ?? err?.status;
        if (status === 404 || status === 410) {
          expiredIds.push(row.id);
        } else {
          failed += 1;
          console.warn(
            `[dm-push] failed for sub ${row.id} status=${status} msg=${err?.message}`,
          );
        }
      }
    }

    if (expiredIds.length > 0) {
      const { error: delErr } = await admin
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
      if (delErr) console.warn("[dm-push] cleanup failed:", delErr.message);
    }

    return json({
      total: subs.length,
      sent,
      failed,
      expired: expiredIds.length,
    });
  } catch (err: any) {
    console.error("[send-message-push] fatal:", err);
    return json({ error: err?.message ?? "unknown_error" }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
