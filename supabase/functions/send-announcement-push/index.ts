// Sends Web Push notifications to all push_subscriptions of an event for one announcement.
// Invoked from:
//  1. Admin UI right after creating/resending an announcement (immediate)
//  2. dispatch-scheduled-announcements cron after flipping sent_at (scheduled)
//
// Auto-cleans expired subscriptions (HTTP 404/410 from push services).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  announcement_id: z.string().uuid(),
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
    // ---- Validate input
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const { announcement_id } = parsed.data;

    // ---- VAPID config
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPublic || !vapidPrivate || !vapidSubject) {
      return json({ error: "vapid_not_configured" }, 500);
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    // ---- Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ---- Load announcement + event slug
    const { data: ann, error: annErr } = await admin
      .from("announcements")
      .select("id, event_id, title, body, sent_at, events:events(event_code)")
      .eq("id", announcement_id)
      .maybeSingle();

    if (annErr) return json({ error: annErr.message }, 500);
    if (!ann) return json({ error: "announcement_not_found" }, 404);
    if (!ann.sent_at) {
      return json({ error: "announcement_not_sent_yet" }, 400);
    }

    const eventCode = (ann as any).events?.event_code ?? "";
    const targetUrl = eventCode ? `/${eventCode}/announcements` : "/announcements";

    // ---- Load all subscriptions for this event
    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, user_id, subscription_json")
      .eq("event_id", ann.event_id);

    if (subsErr) return json({ error: subsErr.message }, 500);
    if (!subs || subs.length === 0) {
      return json({ sent: 0, failed: 0, expired: 0, total: 0 });
    }

    // ---- Build payload (≤ ~3KB to be safe)
    const payload = JSON.stringify({
      title: ann.title,
      body: String(ann.body ?? "").slice(0, 200),
      url: targetUrl,
      tag: `announcement-${ann.id}`,
    });

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    // Send sequentially (small N typical for events). If you need throughput,
    // chunk into Promise.allSettled batches of ~25.
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
            `[push] failed for sub ${row.id} status=${status} msg=${err?.message}`,
          );
        }
      }
    }

    if (expiredIds.length > 0) {
      const { error: delErr } = await admin
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
      if (delErr) {
        console.warn("[push] cleanup failed:", delErr.message);
      }
    }

    return json({
      total: subs.length,
      sent,
      failed,
      expired: expiredIds.length,
    });
  } catch (err: any) {
    console.error("[send-announcement-push] fatal:", err);
    return json({ error: err?.message ?? "unknown_error" }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
