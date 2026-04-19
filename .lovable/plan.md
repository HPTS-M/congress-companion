
Reviso el estado del plan original vs lo implementado.

**Implementado ✅**
- Fase 1.1 Scrollbars branded globales
- Fase 1.2 Filtros asistentes en grid 4 columnas
- Fase 2.1 Migración BD (results_visibility, updated_at, poll_options.is_active, staff_members.is_active, RPC get_poll_aggregate)
- Fase 2.3 updatePoll service + diff de opciones con respuestas
- Fase 2.4 Attendee solo ve confirmación tras votar
- Fase 3.1 getRatings y getPollResponses con nombre + credencial
- Fase 3.2 UI Reports con sección Encuestas + columna Asistente en Ratings
- Fase 4.1 Edge function create-staff-user con email español branded
- Fase 4.2 Migración staff_members.is_active
- Fase 4.3 Login staff con dialogs pending/suspended
- Fase 4.4 UI Staff con badges estado + Switch acceso + activar cuenta
- Fase 4.5 i18n staff es/en
- Hooks useAdminPolls (updatePoll, useAdminPollForEdit) y PollFormModal con modo edición + warning

**Pendiente ⏳**

1. **Fase 2.2 — Bug de creación de encuestas**
   - Verificar que el reset de estado en `PollFormModal` esté en el callback `onSuccess` y no antes (para que si falla la mutación los inputs se conserven con feedback de error).
   - Tooltip con nombre completo en `formatSessionLabel` para sesiones con prefijos similares.

2. **Fase 2.1 (parcial) — RLS de poll_options**
   - Confirmar que las políticas RLS existentes excluyen options con `is_active = false` para attendees (que no vean opciones desactivadas al votar), pero admin sí las vea en resultados históricos.
   - Verificar que el RPC `get_poll_aggregate` esté siendo invocado desde el ResultsModal (o documentar que el conteo actual vía `getPollResults` ya cumple el requisito admin-only por RLS).

3. **Fase 5 — Verificación end-to-end**
   - Casos 3, 4, 5, 6, 11, 12, 13, 14 requieren prueba manual del usuario en el preview real (no preview interno, según LL-005).

**Plan de cierre**

- **Paso A** — Auditar `PollFormModal` en `src/pages/admin/Polls.tsx` y mover el reset al `onSuccess` del callback que pasa `useAdminPolls`. Agregar `title` HTML al `SelectItem` de sesiones para tooltip nativo con nombre completo.
- **Paso B** — Revisar políticas RLS actuales de `poll_options` con `supabase--read_query` y, si hace falta, añadir filtro `is_active = true` para el rol attendee (manteniendo acceso completo para admin). Documentar decisión.
- **Paso C** — Entregar checklist de verificación al usuario para los casos manuales (3, 4, 5, 6, 11–14).

Tras tu aprobación cambio a modo default y ejecuto A → B → C.
