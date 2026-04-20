

## Plan: Sincronización en vivo (Realtime) en pantallas del asistente

### Diagnóstico

Hoy el asistente debe **refrescar manualmente** muchas pantallas porque las suscripciones Realtime están incompletas:

| Pantalla del asistente | Realtime hoy | Comportamiento real |
|---|---|---|
| **Anuncios** (badge + lista) | ❌ solo polling cada 30s | El badge tarda hasta 30s en aparecer; la lista no se actualiza si está abierta |
| **Encuestas** (`/polls`) | ⚠️ suscrita a `polls` pero esa tabla **NO está en la publicación realtime** → no llegan eventos | Encuesta nueva/cerrada por admin no aparece sin refresh |
| **Agenda** (sesiones, contadores "Me interesa") | ❌ ninguno | Cambios del admin (nueva sesión, edición, hora) y contadores de interés no se ven en vivo |
| **Tickets / Servicios contratados** | ❌ (`service_tickets` sí está en realtime, pero `attendee_services` no, y no hay subscripción) | El estado "Pendiente → Usado" no se refleja hasta refrescar |
| **Documentos** | ❌ ninguno | Material académico subido por el admin no aparece sin refresh |
| **Comercial / Patrocinadores** | ❌ ninguno | Cambios del admin no se reflejan |
| **Contactos / Networking** | ❌ ninguno | Aceptación de solicitud, nueva conexión no se ve en vivo |
| **Calificaciones** | ❌ ninguno | Calificaciones desde otro dispositivo del mismo usuario no sincronizan |
| **Mensajes directos** (chat, lista, badge) | ✅ funciona | OK |
| **Check-ins propios** | ❌ ninguno | Si el staff hace check-in escaneando, el asistente no lo ve hasta refrescar |

### Causa raíz

Dos problemas combinados:

1. **Tablas faltantes en `supabase_realtime` publication.** Sin estar publicadas, ningún cliente recibe eventos por más subscripciones que ponga el frontend. Faltan: `announcements`, `polls`, `event_activities`, `session_interests`, `attendee_checkins`, `event_documents`, `sponsors`, `contacts`, `attendee_notes`, `session_ratings`, `attendee_services`, `sponsor_leads`.
2. **Hooks sin subscripción Realtime.** `useAnnouncements`, `useUnreadAnnouncements`, `useActivities`, `useSessionInterests`, `useTickets`, `useDocuments`, `useSponsors`, `useEventAttendees`, `useMyContacts`, `useUserRatings`, `useUserCheckins` solo leen una vez y usan `staleTime` largo.

### Solución

Estrategia de **dos capas** alineada con el patrón ya probado en `usePolls`/`useMessaging`:

**Capa 1 — Backend (migración SQL).** Agregar a la publicación `supabase_realtime` todas las tablas necesarias y poner `REPLICA IDENTITY FULL` en las que enviarán UPDATE/DELETE. Esto NO toca RLS ni datos.

**Capa 2 — Frontend (hooks).** Agregar a cada hook de lectura una suscripción `postgres_changes` filtrada por `event_id` (o `attendee_id` cuando aplique) que invalide su queryKey en TanStack Query. Reusar el mismo patrón de `usePolls`:
- `useEffect` con `supabase.channel(...)` + `removeChannel` en cleanup.
- Re-subscripción tras `attendee:reconnected` (ya emitido por `AttendeeOfflineBanner`).
- Respeto a `useOnlineStatus()` para no abrir canales offline.
- `staleTime` reducido a 30–60s en queries que ahora viven con realtime, para que la primera carga post-navegación tampoco se sienta vieja.

### Cambios concretos

**1. Migración SQL (una sola)**

```sql
-- Habilitar realtime en tablas faltantes
ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.announcements,
  public.polls,
  public.event_activities,
  public.session_interests,
  public.attendee_checkins,
  public.event_documents,
  public.sponsors,
  public.contacts,
  public.attendee_notes,
  public.session_ratings,
  public.attendee_services,
  public.sponsor_leads;

-- REPLICA IDENTITY FULL para tablas con UPDATE/DELETE 
-- (necesario para recibir el row anterior en eventos)
ALTER TABLE public.announcements      REPLICA IDENTITY FULL;
ALTER TABLE public.polls              REPLICA IDENTITY FULL;
ALTER TABLE public.event_activities   REPLICA IDENTITY FULL;
ALTER TABLE public.event_documents    REPLICA IDENTITY FULL;
ALTER TABLE public.sponsors           REPLICA IDENTITY FULL;
ALTER TABLE public.contacts           REPLICA IDENTITY FULL;
ALTER TABLE public.attendee_notes     REPLICA IDENTITY FULL;
ALTER TABLE public.session_ratings    REPLICA IDENTITY FULL;
ALTER TABLE public.attendee_services  REPLICA IDENTITY FULL;
```

Esta migración es **idempotente y segura**: no altera filas, no modifica RLS, no elimina nada. Si una tabla ya está en la publicación, Postgres simplemente ignora el ADD (lo manejamos con guard, ver detalle técnico).

**2. Hooks frontend — agregar Realtime**

Crear un helper compartido `src/hooks/useRealtimeInvalidate.ts` para no repetir el patrón:

```ts
// Suscribe a postgres_changes y invalida queryKeys cuando llega un evento
useRealtimeInvalidate({
  channelName: `announcements-${eventId}`,
  table: 'announcements',
  filter: `event_id=eq.${eventId}`,
  queryKeys: [['announcements', eventId], ['unread-announcements', eventId, attendeeId]],
  enabled: !!eventId && isOnline,
});
```

Lugares donde se usa:

| Hook | Tabla | Filter | Invalida |
|---|---|---|---|
| `useAnnouncements` + `useUnreadAnnouncements` | `announcements` | `event_id=eq.X` | `['announcements', X]`, `['unread-announcements', X, attendeeId]` |
| `useActivities` (en `useAgenda.ts`) | `event_activities` | `event_id=eq.X` | `['activities', X]` |
| `useSessionInterests` | `session_interests` | `event_id=eq.X` | `['session-interests', X]` |
| `useUserCheckins` | `attendee_checkins` | `attendee_id=eq.A` | `['user-checkins', A]`, `['recent-checkins', A]` |
| `useTickets` | `attendee_services` y `service_tickets` | `attendee_id=eq.A` | `['tickets', A]` |
| `useDocuments` | `event_documents` | `event_id=eq.X` | `['documents', X]` |
| `useSponsors` | `sponsors` | `event_id=eq.X` | `['sponsors', X]` |
| `useEventAttendees` + `useMyContacts` | `contacts` | `event_id=eq.X` | `['eventAttendees', X]`, `['myContacts', A]` |
| `useUserRatings` | `session_ratings` | `attendee_id=eq.A` | `['ratings', X, A]` |
| `usePolls` (existente) | ya suscrito a `polls`, ahora **funcionará** porque la tabla queda publicada | sin cambios | sin cambios |

Cada subscripción:
- Se cierra con `supabase.removeChannel(channel)` en cleanup (regla del proyecto).
- Se reconstruye al recibir `attendee:reconnected` (mismo patrón que `usePolls`).
- Solo se abre si `useOnlineStatus()` devuelve `true`.

**3. Bajar `staleTime` en queries con realtime**

De `5 * 60 * 1000` (5min) a `30_000` (30s) en: `useActivities`, `useSessionInterests`, `useUserInterests`, `useUserCheckins`, `useTickets`, `useDocuments`, `useSponsors`. Esto cubre la ventana entre montaje de la página y la primera invalidación realtime.

### Lo que NO cambia

- **Mensajes directos**: ya funcionan vía realtime (`chat_messages`, `chat_conversations`).
- **RLS, schemas, datos**: cero cambios.
- **Edge Functions**: no se tocan.
- **`AppHeader` / badge bell**: ya estaba bien con polling de 30s + invalidación al hacer click; ahora además recibirá invalidación realtime instantánea.
- **El botón manual de "Actualizar" donde exista**: se mantiene como fallback (no estorba).

### Resultado esperado

| Acción del admin | Antes | Después |
|---|---|---|
| Publica anuncio | hasta 30s + refresh manual | < 1s, badge aparece y lista se actualiza |
| Activa/cierra encuesta | refresh manual | < 1s, aparece/desaparece sola |
| Edita sesión de agenda | refresh manual | < 1s, tarjeta se actualiza |
| Sube documento | refresh manual | < 1s, aparece en la lista |
| Marca ticket como usado | refresh manual | < 1s, badge cambia a "Usado" |
| Staff hace check-in | refresh manual | < 1s, aparece en "Mis check-ins" |
| Otro asistente acepta solicitud | refresh manual | < 1s, pasa a "Mis Contactos" |
| Otro asistente marca interés en sesión | contador estático | contador sube en vivo |

### Detalle técnico (para revisión)

- La migración usa un `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` por cada tabla, para ser idempotente y no fallar si una tabla ya está en la publicación.
- `REPLICA IDENTITY FULL` aumenta levemente el WAL pero es necesario para que filtros por columnas distintas a la PK funcionen en UPDATE/DELETE. Se aplica solo a tablas que reciben UPDATE/DELETE, no a las append-only (`attendee_checkins`, `session_interests`, `sponsor_leads`).
- El nuevo helper `useRealtimeInvalidate` se ubica en `src/hooks/` y respeta las reglas del proyecto (cleanup explícito, gating por `useOnlineStatus`, re-subscripción en reconexión).
- Sin nuevas dependencias npm.
- Sin cambios en `src/integrations/supabase/types.ts` (es read-only).

### Verificación post-deploy (3 minutos)

1. Login asistente en `ACQFH-2026` desde dos pestañas (una como atendee, otra como admin).
2. Admin publica un anuncio → atendee ve badge rojo y nueva tarjeta en `/announcements` sin tocar nada.
3. Admin activa una encuesta nueva → atendee la ve aparecer en `/polls`.
4. Admin sube un documento → aparece en `/documents`.
5. Admin marca un ticket del atendee como "Usado" → badge cambia en `/tickets`.
6. Repetir punto 2 con la red apagada/encendida (offline → online): banner verde "Reconectado" + datos sincronizados.

