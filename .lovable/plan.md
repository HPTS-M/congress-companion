
## Plan — Prueba simulada del soporte offline (dry-run end-to-end)

Antes de tocar código, ejecutamos una **simulación estructurada** que valide el plan offline contra el código real, las restricciones de Lovable (preview en iframe = sin SW) y los datos reales del evento `ACQFH-2026`. El objetivo es detectar bloqueos, falsos supuestos y conflictos de configuración **antes** de migrar nada.

---

### Fase 1 — Auditoría estática del estado actual (sin cambios)

Verificación contra código real:

1. **`vite.config.ts`** — confirmar `injectRegister: false` y reglas runtime existentes.
2. **`public/sw.js`** — extraer handlers de Push (`push`, `notificationclick`) que deben migrar al nuevo `src/sw.ts`.
3. **`src/main.tsx`** — confirmar el registro manual `navigator.serviceWorker.register('/sw.js')` y el guard de iframe/preview.
4. **`src/App.tsx`** — localizar el `QueryClientProvider` y revisar `defaultOptions` para definir el filtro del persister.
5. **`src/hooks/usePushSubscription.ts`** — verificar que el flujo de suscripción no se rompe al cambiar el SW.
6. **Servicios cacheables**: `agenda.service.ts`, `tickets.service.ts`, `documents.service.ts`, `sponsors.service.ts` — confirmar que sus query keys son determinísticas y filtradas por `eventId` (requisito del persister).
7. **`AttendeeOfflineBanner`** — confirmar el evento `attendee:reconnected` y los keys que invalida.

Entregable: tabla de hallazgos `OK / requiere ajuste / bloqueo`.

---

### Fase 2 — Matriz de simulación de escenarios

Para cada escenario, documentar: input, comportamiento esperado HOY (sin offline), comportamiento esperado DESPUÉS (con plan implementado), riesgo detectado.

| # | Escenario | Hoy | Post-plan | Riesgo |
|---|-----------|-----|-----------|--------|
| 1 | Login online → cierra app → reabre offline en `/agenda` | 404/error de red | Shell HTML + agenda hidratada desde IndexedDB | SW debe estar activo en el dominio publicado |
| 2 | Online → ve sponsor con logo → offline → vuelve a abrir | Logo se reintenta y falla | Logo desde `CacheFirst` (URL pública) | Si el logo viene de `/object/sign/`, el caché se rompe en 1h |
| 3 | Offline → recarga `/ACQFH-2026/checkin` | Error navegador | Shell carga + `EmptyState` "Necesitas conexión" | `navigateFallback` debe excluir `/admin` y `/~oauth` |
| 4 | Online → abre documento PDF → offline → reabre lista | Error al solicitar signed URL nueva | Lista visible (cache), descarga falla con mensaje claro | Confirmar que el listado de documentos no requiere signed URL |
| 5 | Offline → marca "Me interesa" en sesión | Mutación falla silenciosamente | Encolada en localStorage, reintenta al volver online | Patrón nuevo — no existe hoy fuera de mensajería |
| 6 | Push notification recibida con SW nuevo | Funciona (SW manual) | Debe seguir funcionando (SW unificado con handlers migrados) | Riesgo crítico: si se pierde el handler, se rompen las notificaciones a 35 usuarios activos |
| 7 | Deploy nueva versión mientras usuarios tienen SW viejo | Recarga con cache stale | `autoUpdate` activa nueva versión; `__BUILD_TIME__` invalida persister | Posible "doble carga" en el primer refresh |
| 8 | Logout en dispositivo compartido | Sesión se borra | Persister debe purgarse en logout | Filtro debe excluir datos de otro attendee |
| 9 | Usuario A logueado → usuario B inicia sesión en el mismo dispositivo | Borra sesión A | Persister debe limpiarse al cambiar `attendee.id` | Riesgo de fuga de datos entre asistentes |
| 10 | Preview de Lovable (iframe) | SW deshabilitado intencionalmente | Mismo comportamiento (guard preserved) | Validar que el guard sigue activo tras migrar a `injectManifest` |

---

### Fase 3 — Validación contra datos reales en BD

Queries a ejecutar (read-only) para dimensionar el bundle offline real del evento `ACQFH-2026`:

1. **Tamaño del bundle de prefetch**:
   - Conteo de `event_activities` + payload promedio.
   - Conteo de `sponsors` + tamaño promedio de logos.
   - Conteo de `documents` (metadata, no binarios).
   - Conteo de `attendee_services` por asistente promedio.
   - Estimación de KB totales por asistente.

2. **Verificar fuente de assets**:
   - ¿Los logos de sponsors usan `/object/public/` o `/object/sign/`? Define la regla Workbox.
   - ¿Las fotos de speakers en `event_activities.speaker_photo_url` son públicas o firmadas?
   - ¿El `event.logo_url` y `event.banner_url` son públicas?

3. **Snapshot de uso actual** para priorizar:
   - Top 5 módulos consultados en las últimas 24h (basado en `auth.users.last_sign_in_at` cruzado con tablas de actividad).

Entregable: estimación numérica "X KB por asistente, Y módulos críticos".

---

### Fase 4 — Plan de validación post-deploy (gates)

Cada paso del plan original tiene un gate de validación medible **antes** de pasar al siguiente:

| Paso | Gate de validación | Cómo medir |
|------|-------------------|------------|
| 1. SW unificado | Un solo SW activo en producción, push sigue llegando | DevTools → Application → SW + envío de announcement de prueba |
| 2. navigateFallback | Recarga offline en `/agenda` muestra shell | Test manual en URL publicada con DevTools offline |
| 3. Persister IndexedDB | Reabrir offline pinta agenda sin red | DevTools → Network offline + recarga |
| 4. Workbox runtime | Respuestas vienen `from ServiceWorker` | DevTools → Network |
| 5. UX offline + prefetch | Módulos no soportados muestran EmptyState | Smoke test manual |

---

### Fase 5 — Hallazgos preliminares anticipables

Riesgos que la simulación buscará confirmar/descartar:

- **R1 — Logos de sponsors firmados**: si `sponsors.service.ts` usa signed URLs (memoria `services/sponsors-asset-resolution` lo confirma: 1h de expiración), el caché `CacheFirst` rompería tras 1h. **Mitigación**: cachear el blob por path normalizado, no por URL completa con query string `?token=`.
- **R2 — Auto-join chat trigger**: el trigger `auto_join_group_chat` corre al confirmar asistente; no afecta offline pero confirma que los inserts post-login deben funcionar online primero.
- **R3 — Preview Lovable**: el guard de iframe debe preservarse en `src/sw.ts`; si se pierde, el SW se registra en preview y rompe HMR.
- **R4 — Push handlers**: los 35 usuarios activos pueden perder notificaciones si la migración del SW no preserva exactamente los listeners de `push` y `notificationclick`. Este es el riesgo de mayor impacto.
- **R5 — Realtime + persister**: el persister puede servir datos viejos mientras realtime intenta reconectar; coordinar con el evento `attendee:reconnected` ya existente para invalidar al volver online.

---

### Entregable final de la simulación

Un documento (`/mnt/documents/offline-simulation-report.md`) con:
1. Hallazgos de la auditoría estática (Fase 1).
2. Matriz de los 10 escenarios con resultado esperado y mitigación (Fase 2).
3. Métricas reales de bundle offline (Fase 3).
4. Checklist de gates de validación por paso (Fase 4).
5. Lista priorizada de riesgos con mitigaciones concretas (Fase 5).
6. **Veredicto: GO / GO con ajustes / NO-GO** sobre el plan original.

Solo si la simulación arroja **GO** o **GO con ajustes menores**, procedemos a implementar el plan offline. Si arroja **NO-GO** o ajustes mayores, se replantea antes de tocar código.

---

### Archivos consultados (read-only) durante la simulación

`vite.config.ts`, `public/sw.js`, `src/main.tsx`, `src/App.tsx`, `src/hooks/usePushSubscription.ts`, `src/services/{agenda,tickets,documents,sponsors}.service.ts`, `src/components/layout/AttendeeOfflineBanner.tsx`, más queries SQL read-only contra `event_activities`, `sponsors`, `documents`, `attendee_services` para el evento `ACQFH-2026`.

**Sin cambios en código ni en BD durante esta fase.**
