

## Revisión del plan: Independencia total Mensajería ↔ Anuncios

### Veredicto

El plan **cumple los objetivos** y es claro, pero antes de implementar conviene endurecer algunos puntos de tipado estricto y consistencia con el código actual. A continuación, el plan revisado y blindado.

### Objetivos (chequeo)

| Objetivo | ¿Lo cumple? |
|---|---|
| Ícono de mensajería separado en el header | ✓ |
| Identifica solicitud de chat o mensaje nuevo | ✓ (badge numérico + punto teal pulsante para invitaciones) |
| Sincronizado con módulo de mensajería | ✓ (realtime + invalidación instantánea) |
| Sigue mejores prácticas de la industria | ✓ (separación por canal: LinkedIn/Slack/Gmail) |
| Independencia total entre los dos sistemas | ✓ (hooks separados, storage keys separados, invalidaciones separadas) |

### Refinamientos de tipado estricto y robustez

**1. Tipos explícitos en los nuevos hooks** (no implicit `any`, conforme a `tsconfig: strict`):

```ts
// src/hooks/useUnreadAnnouncements.ts
interface UnreadAnnouncementsResult {
  count: number;
  markAsSeen: () => void;
}
export function useUnreadAnnouncements(eventId: string): UnreadAnnouncementsResult { ... }

// src/hooks/useUnreadMessages.ts
interface UnreadMessagesResult {
  count: number;
  pendingInvites: number;
  unreadMessages: number;
  markAsSeen: () => void;
}
export function useUnreadMessages(eventId: string): UnreadMessagesResult { ... }
```

**2. Guardas robustas** (no romper si `attendee` es `null`, alineado con `isProfileLoading` pattern):
- `enabled: !!attendee?.id && !!eventId` en cada `useQuery`.
- `markAsSeen` no-op si `attendee?.id` es undefined.
- Storage keys solo se construyen cuando `attendee.id` existe.

**3. Migración de la key vieja sin acoplar** los dos hooks:
- Cada hook lee independientemente la key vieja `notifications_last_seen_${attendeeId}` como **fallback de solo lectura** la primera vez.
- Al primer `markAsSeen` de cada tipo se escribe la key nueva específica.
- La key vieja **no se borra** (1 entrada por usuario, despreciable).

**4. Realtime sin canales nuevos**:
- Reutilizar el listener existente en `DirectConversationList.tsx` (sobre `chat_conversations`). Solo se añade una invalidación adicional dentro del callback `invalidate` ya existente:
  ```ts
  queryClient.invalidateQueries({ queryKey: ['unread-messages', eventId] });
  ```
- No tocar `chat_messages` (sigue desactivado conforme al cambio anterior).
- Cumple `realtime-cleanup-pattern` (cleanup intacto).

**5. AppHeader — tipado y orden visual**:

```tsx
const announcements = useUnreadAnnouncements(event?.id ?? '');
const messages = useUnreadMessages(event?.id ?? '');

const handleBellClick = (): void => {
  announcements.markAsSeen();
  navigate(`/${eventSlug}/announcements`);
};

const handleMessagingClick = (): void => {
  messages.markAsSeen();
  navigate(`/${eventSlug}/messaging`);
};
```

Orden en el header (de izq. a der.):
`[🌐] [🔔 anuncios] [💬 mensajes] [👤 avatar]`

**6. Indicador "acción requerida" para invitaciones**:
- Si `messages.pendingInvites > 0 && messages.unreadMessages === 0` → mostrar punto teal `#00B89F` con `animate-pulse`.
- Si `messages.count > 0` (cualquier combinación) → mostrar badge rojo numérico.
- Si `count === 0` y no hay invitaciones → ningún indicador.

**7. i18n estricto** (cero strings hardcodeados):
- Añadir `headerTooltip` en `messaging.json` (es/en) → usado en `aria-label` y `title` del botón.

### Tabla final de comportamiento garantizado

| Acción | Badge campana | Badge chat |
|---|---|---|
| Click campana | Se limpia | Sin cambios |
| Click chat | Sin cambios | Se limpia |
| Llega anuncio nuevo | +1 | Sin cambios |
| Llega invitación | Sin cambios | Punto teal pulsante |
| Llega mensaje nuevo | Sin cambios | +1 (badge rojo) |
| Visita /announcements | Se limpia (vía markAsSeen) | Sin cambios |
| Visita /messaging | Sin cambios | Se limpia (vía markAsSeen) |

### Archivos a modificar (final)

| Archivo | Cambio |
|---|---|
| `src/hooks/useUnreadAnnouncements.ts` | **Nuevo** — interface tipada, queryKey `['unread-announcements', eventId, attendeeId]`, storage key propio |
| `src/hooks/useUnreadMessages.ts` | **Nuevo** — interface tipada, queryKey `['unread-messages', eventId, attendeeId]`, storage key propio |
| `src/hooks/useUnreadCount.ts` | **Eliminar** (único consumidor es `AppHeader`, se migra en el mismo cambio) |
| `src/components/layout/AppHeader.tsx` | Agregar `MessageCircle`, dos handlers separados, indicador dual (badge rojo + punto teal pulsante) |
| `src/components/attendee/DirectConversationList.tsx` | Añadir `queryClient.invalidateQueries({ queryKey: ['unread-messages', eventId] })` dentro del callback `invalidate` ya existente |
| `src/locales/es/messaging.json` | `"headerTooltip": "Mensajería"` |
| `src/locales/en/messaging.json` | `"headerTooltip": "Messaging"` |

### Restricciones honradas

- TypeScript strict, sin `any`.
- Sin nuevas dependencias (`MessageCircle` ya en lucide-react).
- Cumple `notification-system-logic` (storage por tipo, polling 30s independiente).
- Cumple `realtime-cleanup-pattern` (sin canales nuevos).
- Cumple i18n, dark mode, mobile-first (4 íconos caben en 360px).
- Sin cambios a DB, RLS, servicios ni esquema.
- Cero acople entre las dos funcionalidades en datos, storage e invalidaciones.

