import { useEffect, useState, useCallback } from 'react';
import { pendingMessages, type PendingMessage } from '@/lib/pending-messages';

/**
 * Subscribe to the pending-messages queue.
 *
 * - With a `conversationId`: returns only that conversation's pending msgs.
 * - Without it: returns all pending counts (used by the conversation list).
 */
export function usePendingMessages(conversationId?: string) {
  const [items, setItems] = useState<PendingMessage[]>(() =>
    conversationId
      ? pendingMessages.getByConversation(conversationId)
      : pendingMessages.getAll()
  );

  useEffect(() => {
    const sync = () => {
      setItems(
        conversationId
          ? pendingMessages.getByConversation(conversationId)
          : pendingMessages.getAll()
      );
    };
    sync();
    window.addEventListener(pendingMessages.CHANGE_EVENT, sync);
    // Cross-tab sync via storage events
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(pendingMessages.CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [conversationId]);

  const enqueue = useCallback(
    (input: { conversationId: string; senderId: string; content: string }) => {
      const msg = pendingMessages.enqueue(input);
      // Try to flush immediately if online
      if (typeof navigator === 'undefined' || navigator.onLine) {
        window.dispatchEvent(new Event('pending-messages:flush'));
      }
      return msg;
    },
    []
  );

  const retry = useCallback((id: string) => {
    pendingMessages.retry(id);
    window.dispatchEvent(new Event('pending-messages:flush'));
  }, []);

  const remove = useCallback((id: string) => {
    pendingMessages.remove(id);
  }, []);

  return { pending: items, enqueue, retry, remove };
}
