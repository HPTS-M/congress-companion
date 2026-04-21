/**
 * Persistent offline message queue (WhatsApp-style).
 *
 * Messages typed by the attendee while offline (or that fail to send) are
 * stored in localStorage so they survive reload and are retried on reconnect.
 *
 * Data lives under `pending_messages_v2` and is shared across tabs of the
 * same browser. v1 entries are migrated forward on first read.
 *
 * Re-renders are signaled via a custom event:
 *   window.dispatchEvent(new Event('pending-messages:changed'))
 */

export type PendingStatus = 'pending' | 'sending' | 'failed';

export interface PendingMessage {
  id: string;                // client-generated UUID, also used as temp message id
  conversationId: string;
  senderId: string;
  content: string;
  replyToId?: string | null; // optional: message being replied to
  createdAt: string;         // ISO
  status: PendingStatus;
  attempts: number;
  lastError?: string;
}

const STORAGE_KEY = 'pending_messages_v2';
const LEGACY_STORAGE_KEY = 'pending_messages_v1';
const CHANGE_EVENT = 'pending-messages:changed';

function migrateLegacy(): PendingMessage[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return null;
    }
    const migrated: PendingMessage[] = parsed.map((m: Partial<PendingMessage>) => ({
      id: m.id ?? `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId: m.conversationId ?? '',
      senderId: m.senderId ?? '',
      content: m.content ?? '',
      replyToId: null,
      createdAt: m.createdAt ?? new Date().toISOString(),
      status: (m.status as PendingStatus) ?? 'pending',
      attempts: m.attempts ?? 0,
      lastError: m.lastError,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
  } catch {
    return null;
  }
}

function read(): PendingMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const migrated = migrateLegacy();
      return migrated ?? [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: PendingMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore quota / privacy errors
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `pending-${crypto.randomUUID()}`;
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const pendingMessages = {
  CHANGE_EVENT,

  getAll(): PendingMessage[] {
    return read();
  },

  getByConversation(conversationId: string): PendingMessage[] {
    return read().filter(m => m.conversationId === conversationId);
  },

  countByConversation(): Record<string, number> {
    const all = read();
    const map: Record<string, number> = {};
    for (const m of all) {
      map[m.conversationId] = (map[m.conversationId] ?? 0) + 1;
    }
    return map;
  },

  enqueue(input: {
    conversationId: string;
    senderId: string;
    content: string;
    replyToId?: string | null;
  }): PendingMessage {
    const msg: PendingMessage = {
      id: genId(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      content: input.content,
      replyToId: input.replyToId ?? null,
      createdAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };
    write([...read(), msg]);
    return msg;
  },

  markSending(id: string): void {
    const items = read().map(m =>
      m.id === id ? { ...m, status: 'sending' as PendingStatus } : m
    );
    write(items);
  },

  markFailed(id: string, error?: string): void {
    const items = read().map(m =>
      m.id === id
        ? { ...m, status: 'failed' as PendingStatus, attempts: m.attempts + 1, lastError: error }
        : m
    );
    write(items);
  },

  markPending(id: string): void {
    const items = read().map(m =>
      m.id === id ? { ...m, status: 'pending' as PendingStatus } : m
    );
    write(items);
  },

  incrementAttempts(id: string): void {
    const items = read().map(m =>
      m.id === id ? { ...m, attempts: m.attempts + 1 } : m
    );
    write(items);
  },

  remove(id: string): void {
    write(read().filter(m => m.id !== id));
  },

  removeByConversation(conversationId: string): void {
    write(read().filter(m => m.conversationId !== conversationId));
  },

  retry(id: string): void {
    const items = read().map(m =>
      m.id === id ? { ...m, status: 'pending' as PendingStatus, attempts: 0, lastError: undefined } : m
    );
    write(items);
  },
};
