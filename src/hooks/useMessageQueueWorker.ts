import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { pendingMessages, type PendingMessage } from '@/lib/pending-messages';
import { messagingService } from '@/services/messaging.service';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 3000, 9000]; // attempts 1, 2, 3

/**
 * Singleton worker that drains the pending-messages queue.
 *
 * Mount once at the top of AttendeeLayout. Triggered by:
 *  - mount (drains leftovers from previous session)
 *  - `online` event
 *  - custom `attendee:reconnected` event (fired by AttendeeOfflineBanner)
 *  - custom `pending-messages:flush` event (fired after enqueue/retry)
 *
 * Processes messages serially (per-conversation order preserved).
 */
export function useMessageQueueWorker() {
  const qc = useQueryClient();
  const runningRef = useRef(false);
  const queuedRunRef = useRef(false);

  useEffect(() => {
    const drain = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (runningRef.current) {
        queuedRunRef.current = true;
        return;
      }
      runningRef.current = true;

      try {
        // Re-read from storage every iteration to honor external mutations
        let queue = pendingMessages
          .getAll()
          .filter(m => m.status !== 'failed' || m.attempts < MAX_ATTEMPTS);

        // Sort by createdAt to preserve order
        queue.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        for (const msg of queue) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) break;

          await sendOne(msg, qc);
        }
      } finally {
        runningRef.current = false;
        if (queuedRunRef.current) {
          queuedRunRef.current = false;
          // Re-run if requests came in while we were busy
          drain();
        }
      }
    };

    const handler = () => { void drain(); };

    window.addEventListener('online', handler);
    window.addEventListener('attendee:reconnected', handler);
    window.addEventListener('pending-messages:flush', handler);

    // Drain on mount (catches messages left from previous session)
    void drain();

    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('attendee:reconnected', handler);
      window.removeEventListener('pending-messages:flush', handler);
    };
  }, [qc]);
}

async function sendOne(
  msg: PendingMessage,
  qc: ReturnType<typeof useQueryClient>
): Promise<void> {
  pendingMessages.markSending(msg.id);

  try {
    await messagingService.sendMessage(
      msg.conversationId,
      msg.senderId,
      msg.content,
      msg.replyToId ?? null
    );
    // Success: drop it; realtime will deliver the real row.
    pendingMessages.remove(msg.id);
    qc.invalidateQueries({ queryKey: ['direct-messages', msg.conversationId] });
    qc.invalidateQueries({ queryKey: ['direct-conversations'] });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // Permanent failures we should not retry (conversation deleted/blocked)
    const isPermanent =
      /not found|deleted|denied|forbidden|violates row-level security/i.test(errMsg);

    if (isPermanent) {
      pendingMessages.markFailed(msg.id, errMsg);
      return;
    }

    const nextAttempt = msg.attempts + 1;
    if (nextAttempt >= MAX_ATTEMPTS) {
      pendingMessages.markFailed(msg.id, errMsg);
      return;
    }

    // Increment + back off then re-set to pending so a future flush picks it up
    pendingMessages.incrementAttempts(msg.id);
    const wait = BACKOFF_MS[Math.min(nextAttempt, BACKOFF_MS.length - 1)];
    setTimeout(() => {
      pendingMessages.markPending(msg.id);
      window.dispatchEvent(new Event('pending-messages:flush'));
    }, wait);
  }
}
