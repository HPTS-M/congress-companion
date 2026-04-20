

## Plan: Auditoría y optimización de rendimiento — listados y notificaciones

### Diagnóstico (hallazgos concretos)

Audité los flujos de listados (Anuncios, Mensajería, Sponsors, Tickets, Contactos, Polls, Documentos, Agenda) y el sistema de notificaciones (header + sidebar). Encontré **8 cuellos de botella reales** que degradan la experiencia, especialmente en redes 3G/4G y al volver del background:

| # | Módulo | Problema | Impacto |
|---|---|---|---|
| 1 | `useUnreadAnnouncements` + `useUnreadMessages` | Cada uno hace polling cada **30 s** y descarga la lista completa de anuncios/conversaciones para contar localmente. Se ejecutan 2× (header + sidebar) por estar duplicados los hooks | ~4 fetches/min innecesarios por asistente, payload grande |
| 2 | `AppHeader` + `AttendeeSidebar` | Llaman los mismos hooks `useUnread*` por separado en lugar de compartir caché → React Query los deduplica pero igualmente cada componente se re-renderiza independiente | Re-renders extra |
| 3 | `sponsorsService.getByEvent` | Genera signed URLs en serie con `Promise.all(sorted.map(...))` pero cada `resolveStorageUrl` espera al storage. Para 20 sponsors = 40 signed URLs (logo + materials) creadas en el cliente al cargar la pantalla | 800-1500ms en cargar Comercial |
| 4 | `messagingService.getDirectConversations` | Filtra `deleted_by_*` en el cliente después de traer todas las filas, y luego hace **una query adicional** a `public_attendee_directory` para resolver nombres | Doble round-trip por entrar a Mensajería |
| 5 | `pollsService.getActivePolls` | Hace **4 queries secuenciales** (polls, options, all_responses, my_responses). `all_responses` trae **todas las respuestas de todos los asistentes** solo para contarlas en JS | O(N×M) descarga, escala mal con votantes |
| 6 | `AttendeeOfflineBanner` | Al reconectar invalida **7 query keys** simultáneamente sin filtrar por evento → revalida data de todos los eventos cacheados en memoria | Spike de red al reconectar |
| 7 | `attendee-services` realtime | `useTickets` se suscribe a **toda la tabla `service_tickets`** sin filtro porque no tiene `attendee_id`. Cualquier cambio de cualquier ticket en la BD invalida la query del asistente | Re-fetch innecesario en eventos grandes |
| 8 | `App.tsx` QueryClient | `staleTime: 5 min` global pero hooks individuales sobrescriben con 15s/30s. No hay `gcTime` definido → caché crece sin límite | Memory pressure en sesiones largas |

### Decisión

Aplicar 3 grupos de optimizaciones en orden de impacto:

**A. Notificaciones (header + sidebar)** — eliminar polling redundante, mover el conteo al servidor.

**B. Servicios de listado** — reducir round-trips, paralelizar signed URLs, evitar descargar datos que solo se cuentan.

**C. Reconexión y caché** — invalidar de forma quirúrgica, definir TTL/GC explícitos.

Y dejar todo medible para validar en el servidor de producción (En Vivo).

---

### Cambios concretos

#### A. Sistema de notificaciones — del lado servidor

**A1. Nuevas RPCs (migration)**

```sql
-- Conteo de anuncios no leídos contra timestamp del cliente
CREATE OR REPLACE FUNCTION public.count_unread_announcements(
  _event_id uuid,
  _last_seen timestamptz
) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM public.announcements
  WHERE event_id = _event_id
    AND _event_id IN (SELECT public.get_my_event_ids())
    AND sent_at IS NOT NULL
    AND sent_at > _last_seen;
$$;

-- Conteo de invitaciones pendientes + mensajes no leídos
CREATE OR REPLACE FUNCTION public.count_unread_messages(
  _event_id uuid,
  _attendee_id uuid,
  _last_seen timestamptz
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pending_invites', (
      SELECT COUNT(*)::int FROM chat_conversations
      WHERE event_id = _event_id AND conversation_type = 'direct'
        AND status = 'pending' AND participant_id = _attendee_id
        AND deleted_by_participant = false
    ),
    'unread_messages', (
      SELECT COUNT(*)::int FROM chat_conversations
      WHERE event_id = _event_id AND conversation_type = 'direct'
        AND status = 'active'
        AND (initiated_by = _attendee_id OR participant_id = _attendee_id)
        AND last_message_at IS NOT NULL
        AND last_message_at > _last_seen
    )
  );
$$;
```

Payload reducido de ~50 KB (lista completa) a ~50 bytes (un entero/JSON).

**A2. Refactor de hooks**

- `useUnreadAnnouncements` → llamar la RPC en lugar de descargar la lista. Mantener `staleTime: 30s` y eliminar `refetchInterval` (la realtime subscription de `announcements` ya invalida cuando entra uno nuevo).
- `useUnreadMessages` → mismo patrón con la nueva RPC. Eliminar polling.
- Aprovechar la realtime existente (`useRealtimeInvalidate` sobre `announcements` y `chat_conversations`) que ya invalida estas keys: con eso el badge se actualiza en push, sin polling.

**A3. Índices nuevos para soportar los conteos**

```sql
CREATE INDEX IF NOT EXISTS idx_announcements_event_sent_at
  ON public.announcements(event_id, sent_at DESC) WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_status
  ON public.chat_conversations(event_id, participant_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_initiator
  ON public.chat_conversations(event_id, initiated_by, status, last_message_at DESC);
```

#### B. Servicios de listado

**B1. Sponsors** — paralelizar generación de signed URLs y cachear el resultado por sesión:
- `sponsorsService.getByEvent` ya usa `Promise.all`, pero cada item dispara 2 llamadas seriadas a Storage. Cambiar a `Promise.all` plano sobre TODOS los URLs (una sola tanda en vez de N×2).
- Aumentar `staleTime` de `useSponsors` de 30s a 5 min — los sponsors casi no cambian durante el evento.

**B2. Mensajería** — un solo round-trip:
- Crear RPC `get_my_direct_conversations(_event_id, _attendee_id)` que hace el JOIN con `public_attendee_directory` en SQL y aplica el filtro `deleted_by_*` antes de devolver. Reemplaza 2 queries + filter cliente por 1 query.

**B3. Polls** — RPC agregada:
- Reemplazar las 4 queries de `getActivePolls` por una sola RPC `get_active_polls_with_counts(_event_id, _attendee_id)` que devuelve `polls + options + response_count + my_response` en un payload (los counts se calculan en SQL con `GROUP BY`, no se descargan respuestas individuales).

**B4. Tickets realtime** — restringir suscripción:
- Cambiar la realtime de `service_tickets` (sin filtro) a una invalidación por evento de `attendee_services` solamente. Si necesitamos `is_used` en tiempo real, hacer un join en el `select` y bastar con la suscripción a `attendee_services`.

**B5. Documentos** — sin cambios de código pero sí índice:
```sql
CREATE INDEX IF NOT EXISTS idx_documents_event_created_at
  ON public.documents(event_id, created_at DESC);
```

#### C. Reconexión y caché

**C1. `AttendeeOfflineBanner` reconnect** — invalidación quirúrgica:
- Solo invalidar las query keys del **evento actual** (leer `eventSlug` del context). Reduce el spike de red al reconectar.
- Dispatch `attendee:reconnected` se mantiene (las realtime channels lo necesitan).

**C2. QueryClient global** (`App.tsx`):
```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // baja de 5 min a 1 min — más fresh sin pegarle al server
      gcTime: 10 * 60_000,         // colectar caché vieja a los 10 min
      retry: 1,
      refetchOnReconnect: 'always',
      refetchOnWindowFocus: false, // evita doble fetch al volver de background
    },
  },
});
```

#### D. Instrumentación para validación en producción

**D1. Helper `lib/perf.ts`** — pequeña utilidad que envuelve queries críticas y emite breadcrumbs a Sentry con duración y tamaño de payload:

```ts
export async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    const result = await fn();
    Sentry.addBreadcrumb({
      category: 'perf', level: 'info',
      message: `${label} ${(performance.now() - t0).toFixed(0)}ms`,
      data: { duration_ms: performance.now() - t0 },
    });
    return result;
  } catch (e) {
    Sentry.captureException(e, { tags: { perf_label: label } });
    throw e;
  }
}
```

Aplicarla en los 5 servicios refactorizados (announcements, messaging, polls, sponsors, tickets).

**D2. Web Vitals (sin libs nuevas)** — emitir en `main.tsx` `LCP`, `INP`, `CLS` usando `PerformanceObserver` nativo y enviar a Sentry como custom metrics. Cero overhead en build.

**D3. Validación en producción (En Vivo)** — protocolo:
1. Login asistente en `https://congress-connect-app.lovable.app/ACQFH-2026` desde Chrome DevTools con throttling **Slow 4G**.
2. Recorrer cada listado (Agenda, Tickets, Comercial, Contactos, Documentos, Mensajería, Anuncios, Polls) y registrar:
   - Time to first byte de la query principal (visible en Network tab → tiempo de la query Supabase)
   - Render-to-interactive (clic en cualquier elemento responde < 100ms)
   - Tamaño del payload por endpoint
3. Verificar en el dashboard de Sentry → "Performance" que aparezcan las custom metrics `perf.list.announcements`, `perf.list.sponsors`, etc., con p95 < 800ms.
4. Apagar/encender red 3 veces seguidas → confirmar que el banner ámbar aparece, se sincroniza en < 2s, y no hay spike de >5 requests simultáneos en Network.
5. Comparar con baseline pre-cambios (capturar antes de aplicar cambios para tener métrica comparable).

### Cambios fuera de alcance (intencionalmente)

- No se toca el flujo de autenticación ni el de credenciales (ya cubierto en planes anteriores).
- No se introduce paginación nueva — los listados actuales no exceden 100 items por evento. Si crece en el futuro, agregar paginación es un cambio aislado.
- No se reemplaza TanStack Query — sigue siendo la pieza correcta.

### Detalles técnicos (para revisión técnica del equipo)

**Migrations**
1. Crear funciones `count_unread_announcements`, `count_unread_messages`, `get_my_direct_conversations`, `get_active_polls_with_counts`.
2. Crear índices: `idx_announcements_event_sent_at`, `idx_chat_conversations_participant_status`, `idx_chat_conversations_initiator`, `idx_documents_event_created_at`.
3. Permisos: GRANT EXECUTE de las 4 RPCs a `authenticated`.

**Archivos modificados**
- `src/services/announcements.service.ts` — añadir `getUnreadCount(eventId, lastSeen)` que llama RPC.
- `src/services/messaging.service.ts` — refactor `getDirectConversations` para usar RPC; añadir `getUnreadCounts`.
- `src/services/polls.service.ts` — refactor `getActivePolls` a una RPC.
- `src/services/sponsors.service.ts` — paralelizar signed URLs.
- `src/hooks/useUnreadAnnouncements.ts` — RPC + sin polling.
- `src/hooks/useUnreadMessages.ts` — RPC + sin polling.
- `src/hooks/useTickets.ts` — quitar suscripción global a `service_tickets`.
- `src/hooks/useSponsors.ts` — `staleTime: 5 min`.
- `src/components/layout/AttendeeOfflineBanner.tsx` — invalidar solo queries del evento actual.
- `src/App.tsx` — config QueryClient.
- `src/lib/perf.ts` — nuevo helper.
- `src/main.tsx` — Web Vitals observer.

**Resultados esperados (métricas objetivo)**
| Métrica | Antes (estimado) | Después (objetivo) |
|---|---|---|
| Carga de Comercial (Slow 4G) | 1500-2500 ms | < 800 ms |
| Carga de Mensajería (Slow 4G) | 800-1200 ms | < 400 ms |
| Polling de notificaciones | 4 req/min × asistente | 0 req/min (push only) |
| Payload de unread-messages | ~30 KB | ~80 bytes |
| Spike de red al reconectar | 7-10 reqs simultáneos | 2-3 reqs (solo evento actual) |
| LCP (Slow 4G, página listado) | ~3.5 s | < 2.5 s |

