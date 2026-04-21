import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Manages this device's Web Push subscription:
 *  - Only acts after Notification.permission === 'granted'
 *  - Idempotent upsert into push_subscriptions (user_id + event_id unique)
 *  - Re-subscribes automatically on `pushsubscriptionchange`
 *
 * Requesting permission is NOT done here — it must be triggered by an
 * explicit user gesture (banner button) for browser policy compliance.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

async function subscribeAndPersist(
  attendeeId: string,
  eventId: string,
): Promise<void> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VITE_VAPID_PUBLIC_KEY missing — skipping subscribe');
    return;
  }

  const reg = await getRegistration();
  if (!reg) return;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (err) {
      console.warn('[Push] subscribe failed', err);
      return;
    }
  }

  const json = subscription.toJSON();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: attendeeId,
        event_id: eventId,
        subscription_json: json as any,
      },
      { onConflict: 'user_id,event_id' },
    );

  if (error) {
    console.warn('[Push] upsert failed', error.message);
  }
}

export function usePushSubscription(): void {
  const { attendee } = useAuth();
  const attendeeId = attendee?.id;
  const eventId = attendee?.event_id;
  const handlerRef = useRef<((e: Event) => void) | null>(null);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (!attendeeId || !eventId) return;
    if (Notification.permission !== 'granted') return;

    // Initial subscribe + persist (best effort, errors swallowed inside)
    subscribeAndPersist(attendeeId, eventId);

    // Handle browser-driven re-subscription (key rotation, etc.)
    const onChange = () => {
      subscribeAndPersist(attendeeId, eventId);
    };
    handlerRef.current = onChange;

    getRegistration().then((reg) => {
      reg?.addEventListener?.('pushsubscriptionchange', onChange as EventListener);
    });

    return () => {
      const fn = handlerRef.current;
      if (!fn) return;
      getRegistration().then((reg) => {
        reg?.removeEventListener?.('pushsubscriptionchange', fn as EventListener);
      });
    };
  }, [attendeeId, eventId]);
}

/**
 * Helper to be called from the opt-in banner.
 * Returns the new permission state.
 */
export async function requestPushPermissionAndSubscribe(
  attendeeId: string,
  eventId: string,
): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';

  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = 'denied';
    }
  }

  if (permission === 'granted') {
    await subscribeAndPersist(attendeeId, eventId);
  }
  return permission;
}
