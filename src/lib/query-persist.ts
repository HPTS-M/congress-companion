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
declare const __BUILD_TIME__: string;
export function getPersistBuster(attendeeId: string | null | undefined): string {
  const buildTime = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev';
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
    'activities',          // useActivities
    'session-interests',   // useSessionInterests (aggregated counts)
    'user-interests',      // useUserInterests (own rows)
    'user-checkins',       // useUserCheckins
    'sponsors',            // useSponsors (list)
    'sponsor',             // useSponsor (detail)
    'documents',           // useDocuments
    'tickets',             // useTickets
    'event',               // useEvent
    'event-config',
    'announcements',       // useAnnouncements
    'myContacts',          // useContacts
    'attendeeProfile',     // useAttendeeProfile
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
