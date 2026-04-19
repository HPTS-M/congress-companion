

## Plan: Ajustes globales + Encuestas + Staff

### Decisiones aplicadas
- **Reportes**: mostrar nombre + credencial del asistente.
- **Edición de encuestas con respuestas**: permitida con advertencia clara.
- **Visibilidad de resultados**: respuestas de encuestas son **solo para administrador** (asistente nunca ve agregados; tras votar solo confirmación).
- **Estados staff**: `pending` (sin acceso, popup al intentar entrar) / `active` (acceso habilitado). Cuando ya está `active`, toggle adicional `is_active` para revocar/restaurar acceso sin borrar.

---

### Fase 1 — Ajustes globales

**1.1 Scrollbars con tema de la app (`src/index.css`)**
- Aplicar la regla `.scrollbar-branded` (ya existente) globalmente sobre `html`, `body`, contenedores `overflow-*`, y `[data-radix-scroll-area-viewport]` (Radix). Track transparente, thumb `hsl(var(--primary)/0.4)` → hover `hsl(var(--accent))`. 8px en desktop, 6px en mobile. Tanto vertical como horizontal.
- Compatibilidad Firefox (`scrollbar-width`, `scrollbar-color`) y WebKit.

**1.2 Filtros rápidos asistentes sin scroll (`src/pages/admin/Attendees.tsx`)**
- Reemplazar `<TabsList className="w-full justify-start overflow-x-auto sm:w-auto">` por un grid responsive de 4 columnas (`grid grid-cols-4 w-full`) con `TabsTrigger` que se ajustan: texto truncado a su contenedor, badges visibles solo en `sm+`. Los 4 estados (Todos, Confirmado, Pendiente, Cancelado) caben sin overflow incluso a 360px.

---

### Fase 2 — Encuestas: corregir creación + edición + visibilidad

**2.1 Migración BD**
- `polls`: agregar `results_visibility text NOT NULL DEFAULT 'admin_only'` (único valor por ahora; campo pensado a futuro).
- `polls`: agregar `updated_at timestamptz DEFAULT now()` + trigger `update_updated_at`.
- Quitar política `Attendees read active poll options` y `Attendees read active polls` solo para resultados agregados → la lectura de **respuestas** sigue siendo admin-only (ya está). Mantener: el asistente puede leer la pregunta y sus opciones para votar, pero **no** los resultados.
- RPC nuevo `get_poll_aggregate(_poll_id)` → `SECURITY DEFINER`, valida que el caller sea admin de la org y retorna conteos. El attendee no puede invocarlo.

**2.2 Bug de creación**
- `useAdminPolls.createPoll.onSuccess` cierra el modal correctamente, pero `NewPollModal` resetea estado **antes** de que `mutate` complete → si falla, los inputs quedan vacíos sin retroalimentación. Mover el reset al `onSuccess` callback dentro del modal.
- `formatSessionLabel` truncado puede colisionar con sesiones con mismo prefijo + hora → agregar `key={s.id}` (ya está) y mostrar nombre completo en tooltip.
- Validar que `pollType=rating_scale` no requiera opciones manuales (trigger `auto_create_rating_options` ya las crea); UI ya respeta esto.

**2.3 Edición de encuestas**
- Servicio `adminPollsService.updatePoll(id, { question, sessionId, options })` con detección de respuestas existentes:
  - Si `response_count > 0`: el modal muestra alerta amber "Esta encuesta tiene N respuestas. Editar opciones puede invalidar resultados".
  - Para opciones: si hay respuestas, hacer **diff** (nuevas opciones se insertan; las eliminadas no se borran si tienen respuestas, se marcan inactivas — agregar columna `is_active` a `poll_options`).
- `AdminPolls.tsx`: nueva acción "Editar" en cada fila → reusa `NewPollModal` en modo edición (rename a `PollFormModal`).

**2.4 Visualización admin en tiempo real**
- `ResultsModal` ya usa `usePollRealtime` correctamente. Verificar que el canal se cierre al cerrar el modal (cleanup en useEffect).
- Lado attendee: tras votar, mostrar solo "✓ Respuesta enviada. Los resultados son privados." Eliminar componentes `ChoiceResults` / `RatingResults` del flujo del asistente; el admin sigue viéndolos en `ResultsModal`.

---

### Fase 3 — Reportes: identificar usuarios

**3.1 `admin-reports.service.ts`**
- `getRatings`: cambiar select a `ratings → user_id, stars, comment, created_at` y joinear `attendees` para `full_name + credential_code`. Devolver array de comentarios con autor: `comments: { author_name, credential_code, comment, stars, created_at }[]`.
- Nueva función `getPollResponses(eventId)`: lista todas las respuestas de encuestas con autor (nombre + credencial), pregunta, opción/texto, timestamp.
- Exportador Excel: agregar columnas Nombre y Credencial en hojas Ratings y Polls.

**3.2 UI Reports**
- Nueva subsección "Encuestas" en `pages/admin/Reports.tsx` con tabla de respuestas (paginada, filtro por encuesta).
- Columna "Asistente" en panel de Ratings con nombre + credencial visible.

---

### Fase 4 — Staff: emails + estados

**4.1 Edge function `create-staff-user`**
- Templates de email rediseñados en español con identidad de marca (CONGRÉSSAPP / Health Plus Travels). Subject: "Acceso al Staff de [Evento]". Body: saludo personalizado, explicación rol, link clickable (`APP_URL.replace(/\/+$/,'') + /{event_code}/staff`), credenciales temporales si aplica, contacto de soporte.
- Reemplazar invocación cruda de Supabase Auth invite con template `redirectTo` apuntando a `/staff/login`.
- Sanitizar `APP_URL` (quitar trailing slash) — regla LL-recurrente.

**4.2 Migración BD**
- `staff_members`: agregar `is_active boolean DEFAULT true` (revocación de acceso sin borrar).
- Posibilidad de reactivar: setear `is_active=true` re-habilita login.

**4.3 Lógica de acceso (Staff portal)**
- En `pages/staff/Login.tsx` (después de validar credenciales): consultar `staff_members.invitation_status` y `is_active`:
  - `invitation_status = 'pending'` → mostrar dialog "Tu cuenta aún no ha sido activada por el administrador. Contacta a soporte." y bloquear sesión.
  - `invitation_status = 'active' AND is_active = false` → dialog "Tu acceso ha sido suspendido." y bloquear.
  - Resto: ingreso normal, actualiza `last_login`.

**4.4 UI Staff (`pages/admin/Staff.tsx`)**
- Tabla: nuevas columnas "Estado" (badge active/pending) y "Acceso" (Switch para `is_active`, solo visible si `invitation_status='active'`).
- Acción rápida "Activar cuenta" (botón verde) para staff `pending` → cambia a `active` y dispara invitación.
- Servicios `useUpdateStaffStatus(id, status)` y `useToggleStaffAccess(id, is_active)` con invalidación de query.

**4.5 i18n**
- Agregar claves: `staff.statusActiveLabel`, `staff.statusPendingLabel`, `staff.accessEnabled`, `staff.accessDisabled`, `staff.activateAccount`, `staff.suspendAccess`, `staff.restoreAccess`, `staff.pendingDialogTitle`, `staff.pendingDialogBody`, `staff.suspendedDialogBody`. Español primario, inglés secundario.

---

### Fase 5 — Verificación

| # | Caso | Esperado |
|---|------|----------|
| 1 | Scroll en cualquier tabla/lista | Thumb azul primario, hover teal |
| 2 | Filtros asistentes en 360px | 4 tabs visibles sin overflow |
| 3 | Crear encuesta single_choice válida | Sin errores, modal cierra, aparece en lista |
| 4 | Crear rating_scale sin opciones manuales | Trigger genera 1-5 automático |
| 5 | Editar encuesta sin respuestas | Cambios persisten |
| 6 | Editar encuesta con respuestas | Alerta amber, opciones eliminadas se marcan inactivas |
| 7 | Asistente vota | Solo ve "✓ Respuesta enviada" |
| 8 | Admin abre Resultados | Ve conteos en tiempo real |
| 9 | Reporte Ratings | Comentarios muestran autor + credencial |
| 10 | Reporte Encuestas | Tabla con respuestas + autor |
| 11 | Crear staff nuevo | Email en español con link funcional |
| 12 | Login staff `pending` | Dialog bloquea, no entra |
| 13 | Toggle `is_active=false` y login | Dialog "suspendido" |
| 14 | Activar staff pending | Cambia badge, permite login |
| 15 | i18n es/en completo | Sin claves faltantes |

