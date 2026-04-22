// IndexedDB-backed persister for TanStack Query.
// Survives 5MB localStorage cap and supports binary-friendly serialization.
import { get, set, del } from 'idb-keyval';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';

const IDB_KEY = 'congressapp-rq-cache';

const idbStorage = {
  getItem: async (key: string) => (await get(key)) ?? null,
  setItem: async (key: string, value: string) => {
    await set(key, value);
  },
  removeItem: async (key: string) => {
    await del(key);
  },
};

export const queryPersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: IDB_KEY,
  // Keep payloads compact; default JSON.stringify is fine for our data.
  throttleTime: 1000,
});

/**
 * Buster combines build time + attendee id, so:
 *  - A new deploy invalidates everyone's cache (build time changes)
 *  - Switching attendees on the same device wipes prior data (no PII leak)
 */
export function getPersistBuster(attendeeId: string | null | undefined): string {
  // @ts-expect-error — injected by Vite define
  const buildTime = (typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev');
  return `${buildTime}::${attendeeId ?? 'anon'}`;
}

/**
 * Decide which queries are safe & useful to persist offline.
 * - Whitelist read-only event content (agenda, sponsors, docs, tickets, profile, map, contacts).
 * - Exclude messaging, polls, push state, mutations.
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const [name] = queryKey as [string, ...unknown[]];
  if (typeof name !== 'string') return false;

  const persistable = new Set([
    'agenda',
    'agenda-interest-counts',
    'agenda-user-interests',
    'agenda-user-checkins',
    'sponsors',
    'sponsor-detail',
    'documents',
    'tickets',
    'event',
    'event-config',
    'announcements',
    'myContacts',
    'attendee-profile',
  ]);
  return persistable.has(name);
}

/** Hard-purge persisted cache (used on logout / attendee switch). */
export async function purgePersistedCache(): Promise<void> {
  try {
    await del(IDB_KEY);
  } catch {
    // ignore
  }
}

/** Convenience for callers that want to clear & reset the in-memory client too. */
export async function resetQueryClientAndPersister(client: QueryClient): Promise<void> {
  client.clear();
  await purgePersistedCache();
}
