

## Plan revisado: Persistir "última vez que viste mensajes" en el servidor

Aplica el mismo patrón de los anuncios al sistema de mensajes directos para que el contador de la campana sobreviva al cambio de dispositivo, modo incógnito o limpieza de caché. Revisé el código actual y la base de datos — ninguna de las dos migraciones (anuncios ni mensajes) está implementada todavía, así que las hacemos juntas para reutilizar la misma lógica de migración del `localStorage`.

### Diagnóstico confirmado en código

- `useUnreadMessages.ts` (línea 32-41) lee `last_seen` desde `localStorage.messages_last_seen_{attendeeId}` con fallback al legacy `notifications_last_seen_*`.
- RPC actual `count_unread_messages(_event_id uuid, _attendee_id uuid, _last_seen timestamptz) → jsonb` recibe el timestamp del cliente — manipulable y por dispositivo.
- `pendingInvites` no necesita `last_seen` (es estado real en `chat_conversations.status='pending'`). Solo migramos `unreadMessages`.

### Cambios

#### 1. Migración SQL — nueva tabla `attendee_message_views`

```sql
CREATE TABLE public.attendee_message_views (
  attendee_id  uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attendee_id, event_id)
);

ALTER TABLE public.attendee_message_views ENABLE ROW LEVEL SECURITY;

-- LL-002: RESTRICTIVE bloquea anon
CREATE POLICY "block_anon_access"
  ON public.attendee_message_views AS RESTRICTIVE
  FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- PERMISSIVE para authenticated (asistente solo gestiona su propio registro)
CREATE POLICY "Attendee read own message view"
  ON public.attendee_message_views FOR SELECT TO authenticated
  USING (attendee_id IN (SELECT public.get_my_attendee_ids()));

CREATE POLICY "Attendee insert own message view"
  ON public.attendee_message_views FOR INSERT TO authenticated
  WITH CHECK (attendee_id IN (SELECT public.get_my_attendee_ids()));

CREATE POLICY "Attendee update own message view"
  ON public.attendee_message_views FOR UPDATE TO authenticated
  USING (attendee_id IN (SELECT public.get_my_attendee_ids()))
  WITH CHECK (attendee_id IN (SELECT public.get_my_attendee_ids()));

GRANT SELECT, INSERT, UPDATE ON public.attendee_message_views TO authenticated;
```

#### 2. RPCs nuevas / modificadas (todas `SECURITY DEFINER`, `SET search_path = public`)

- **`mark_messages_seen(_event_id uuid)`** — upsert `last_seen_at = now()` para el primer `attendee_id` del usuario en ese evento. Devuelve `void`. `WHERE attendees.user_id = auth.uid()`.

- **`count_unread_messages(_event_id uuid)` — modificar firma**:
  - Eliminar parámetros `_attendee_id` y `_last_seen`.
  - Resolver `attendee_id` internamente vía `auth.uid()`.
  - Leer `last_seen_at` desde `attendee_message_views` con `COALESCE(..., 'epoch'::timestamptz)`.
  - Retorno sin cambios: `jsonb { pending_invites, unread_messages }`.

- **`seed_messages_seen(_event_id uuid, _last_seen timestamptz)`** — migración suave: `INSERT ... ON CONFLICT DO NOTHING` con el timestamp del `localStorage`. Si ya existe registro servidor, no hace nada.

#### 3. Frontend — `src/services/messaging.service.ts`

- `getUnreadCounts(eventId: string): Promise<UnreadCounts>` — quitar `attendeeId` y `lastSeen` de la firma. Llamar a `count_unread_messages` solo con `_event_id`.
- Nuevo `markSeen(eventId: string): Promise<void>` → RPC `mark_messages_seen`.
- Nuevo `seedSeen(eventId: string, lastSeen: Date): Promise<void>` → RPC `seed_messages_seen`.

#### 4. Frontend — `src/hooks/useUnreadMessages.ts`

- Eliminar `LEGACY_KEY_PREFIX`, `NEW_KEY_PREFIX`, `getLastSeen()`, `storageKey`, `legacyKey`.
- `markAsSeen` pasa a usar `useMutation` de TanStack Query (best practice — hoy el `useCallback` invoca un side-effect síncrono, ahora será async):

```ts
const markSeenMutation = useMutation({
  mutationFn: () => messagingService.markSeen(eventId),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unread-messages', eventId, attendeeId] }),
});
const markAsSeen = useCallback(() => { markSeenMutation.mutate(); }, [markSeenMutation]);
```

- Migración suave (una vez por sesión, dentro de un `useEffect` con guard en `sessionStorage.messages_seed_done_{attendeeId}`):
  1. Si existe `localStorage.messages_last_seen_{attendeeId}` → llamar `seedSeen(eventId, parsed)`.
  2. Limpiar la clave de `localStorage` (y la legacy `notifications_last_seen_*`).
  3. Marcar el guard para no reintentar.

- Mantener la subscripción realtime sobre `chat_conversations` (ya cubre nuevos mensajes vía `last_message_preview` UPDATE y nuevas invitaciones vía INSERT).

#### 5. Plan idéntico para anuncios (consolidado)

Como el plan de anuncios aprobado no se ejecutó aún, lo incluimos en el mismo deploy con la misma estructura:

- Tabla `attendee_announcement_views` (mismo schema y RLS).
- RPCs `mark_announcements_seen(_event_id)`, `seed_announcements_seen(_event_id, _last_seen)`, modificar `count_unread_announcements` para quitar `_last_seen`.
- Refactor `useUnreadAnnouncements.ts` y `announcements.service.ts` simétrico al de mensajes.

---

### Resultado

| Escenario | Antes | Después |
|---|---|---|
| Veo mensajes y vuelvo en mismo navegador | 0 ✓ | 0 ✓ |
| Otro dispositivo / incógnito | **N (mal)** | 0 ✓ |
| Limpio caché y vuelvo | **N (mal)** | 0 ✓ |
| Llega mensaje nuevo | 1 ✓ | 1 ✓ (realtime) |
| Recibo invitación | 1 ✓ | 1 ✓ (no usa last_seen) |
| Acepto/rechazo invitación | 0 ✓ | 0 ✓ |

---

### Best practices aplicadas (revisión)

1. **RLS LL-002** — RESTRICTIVE anon + PERMISSIVE authenticated + GRANT explícito.
2. **RPC LL pattern** — `SECURITY DEFINER` con `SET search_path = public`, usa `auth.uid()` internamente sin recibirlo como parámetro manipulable.
3. **Sin recursión RLS** — usa el helper existente `get_my_attendee_ids()` (no consulta `attendees` directamente desde la policy).
4. **TanStack Query** — `useMutation` para acciones que mutan el servidor, en lugar de `useCallback` con side-effect crudo.
5. **Realtime cleanup** — la subscripción existente ya usa `useRealtimeInvalidate` que limpia con `removeChannel` al desmontar.
6. **Migración suave one-shot** — `sessionStorage` guard para evitar reintentar el seed en cada render.
7. **Backward compatibility** — el `seed` se hace `ON CONFLICT DO NOTHING`, así un usuario que ya esté usando el servidor en un dispositivo no pierde su `last_seen` cuando entra desde otro con `localStorage` viejo.
8. **Sin cambios visuales** — pura mejora de backend.

---

### Archivos afectados

```text
NUEVO  supabase/migration                       — 2 tablas, 6 RPCs (3 mensajes + 3 anuncios),
                                                  ALTER count_unread_messages, ALTER count_unread_announcements
EDIT   src/hooks/useUnreadMessages.ts           — quitar localStorage, useMutation, seed one-shot
EDIT   src/hooks/useUnreadAnnouncements.ts      — idem
EDIT   src/services/messaging.service.ts        — markSeen + seedSeen, firma nueva getUnreadCounts
EDIT   src/services/announcements.service.ts    — markSeen + seedSeen, firma nueva getUnreadCount
```

Sin cambios visuales. Sin nuevas dependencias. RLS estricta validada contra el patrón LL-002 del proyecto.

---

### Verificación

1. Asistente A envía un mensaje a B → en B la campana sube a 1.
2. B abre la pantalla de Mensajería → campana baja a 0 (servidor registra `last_seen_at`).
3. B cierra sesión y vuelve a entrar (mismo navegador) → sigue en 0.
4. B entra desde otro dispositivo / incógnito → **sigue en 0** (antes mostraba 1).
5. A envía otro mensaje → la campana de B sube a 1 en tiempo real.
6. A envía invitación nueva a B → campana sube a 1 (componente de invitaciones, independiente del `last_seen`).
7. B acepta o rechaza → vuelve a 0 inmediatamente.
8. Mismo flujo con la pantalla de Anuncios.
9. Verificar en DB: `SELECT * FROM attendee_message_views WHERE attendee_id = '...';` muestra el `last_seen_at` actualizado.

