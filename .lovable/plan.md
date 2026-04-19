

El usuario quiere que valide el plan actual contra las buenas prácticas del proyecto (knowledge base + lecciones aprendidas). Reviso el plan en `.lovable/plan.md` y lo confronto con las reglas oficiales antes de proponer mejoras.

Reviso rápido los puntos críticos del knowledge base aplicables:
- LL-001/LL-002: RLS dual anon+authenticated, RESTRICTIVE+PERMISSIVE
- Backend-first: migración → RLS → tipos → hooks → componentes
- i18n obligatorio (es/en), mobile-first 360px
- ExcelJS (NO xlsx) — ya cubierto en `src/lib/excel.ts`
- Realtime cleanup con `removeChannel`
- Dark mode con `dark:` variants
- TanStack Query para server state
- Skeleton screens + estados loading/error
- Tipos TS estrictos, no `any`
- No llamar Supabase desde componentes (usar services)

Detecto que el plan actual cubre lo funcional pero le faltan varios checks de buenas prácticas. Presento el plan revisado y completado.

## Revisión del Plan: Fase A — Encuestas + Exportación

### Auditoría de buenas prácticas

| Buena práctica del proyecto | Plan actual | Gap |
|---|---|---|
| Backend-first (migración → RLS → tipos → hooks → UI) | ✅ Sí | OK |
| ExcelJS (no xlsx) | ✅ Implícito (usa `writeExcelFile`) | Hacerlo explícito |
| RLS dual anon+authenticated en tablas tocadas | ⚠️ No revisado | Verificar `poll_options` y `poll_responses` |
| i18n es/en para todos los strings nuevos | ✅ Mencionado | Listar claves exactas |
| Mobile-first 360px (checkboxes en multiple_choice) | ❌ No mencionado | Añadir |
| Dark mode con `dark:` variants | ❌ No mencionado | Añadir |
| Skeleton/loading state en exportación | ❌ No mencionado | Añadir |
| TanStack Query para nueva data | ❌ No mencionado | Añadir para `getTextResponses` |
| Tipos TS estrictos (sin `any`) | ❌ No mencionado | Añadir |
| Realtime cleanup en ResultsModal open_text | ⚠️ Posible gap | Verificar |
| Validación Zod en formularios admin | ❌ No aplica (no hay form nuevo) | OK |
| Linter Supabase post-migración | ✅ Punto 7 verificación | OK |
| Sin llamadas Supabase desde componentes | ✅ Service `admin-polls-excel.service.ts` | OK |
| Performance: archivos grandes paginados | ❌ No mencionado para export | Añadir batching |

### Plan completado y mejorado

#### 1. Migración SQL (backend-first)

- Poblar opciones 1–5 para los 3 `rating_scale` vacíos.
- Trigger `AFTER INSERT` en `polls`: si `poll_type='rating_scale'`, insertar 5 filas en `poll_options`.
- `UNIQUE(poll_id, attendee_id)` en `poll_responses` — **excepción:** parcial WHERE `option_id IS NOT NULL` para permitir múltiples filas en `multiple_choice` (un voto = N filas, una por opción).
- **Verificar RLS post-migración:** `poll_options` y `poll_responses` deben mantener políticas dual anon (block) + authenticated (existentes ya están OK según schema).
- Correr `supabase--linter` después.

#### 2. Tipos TS (antes de hooks)

- Actualizar `src/services/polls.service.ts`: `submitResponse` acepta `optionIds: string[] | null` en vez de `optionId: string | null`.
- Definir `interface OpenTextResponseRow { attendee_name: string; credential_code: string; text_response: string; created_at: string }` en service admin.
- Definir `interface PollExportRow` para cada hoja del Excel (3 interfaces).
- **Sin `any`.**

#### 3. Hooks/services

- `usePolls.submitResponse`: insertar N filas si multiple_choice (un `Promise.all` de inserts).
- `adminPollsService.getAllResponsesForExport(eventId)` — query agregada con joins.
- `adminPollsService.getTextResponses(pollId)` — ya existe, exponerlo en hook nuevo `useAdminPollTextResponses(pollId)` con TanStack Query (`staleTime: 10s`).

#### 4. UI asistente — `src/pages/attendee/Polls.tsx`

- `RatingForm`: eliminar fallback `rating-N`. Si `options.length === 0` → mostrar `<EmptyState>` con `t('polls.malformed')`.
- `ChoiceForm`: rama por `pollType`:
  - `single_choice` → `RadioGroup` (actual)
  - `multiple_choice` → `Checkbox[]` con state `Set<string>`, hint `t('polls.multiSelectHint')`
- Mobile-first: checkboxes con `min-h-11` (44px touch target), spacing `gap-3`, dark mode `dark:bg-slate-800`.

#### 5. UI admin

- `ResultsModal`:
  - Para `open_text` → renderizar lista con TanStack Query loading skeleton, dark mode, `<ScrollArea>` si >5 respuestas.
  - Botón **"Exportar esta encuesta"** con icon `Download`, estado `isExporting` (spinner mientras genera).
- `Polls.tsx` header: botón **"Exportar respuestas"** junto a "Importar Polls", mismo patrón loading.
- `NewPollModal`: ocultar input de opciones cuando `pollType === 'rating_scale'` (el trigger las genera).

#### 6. Servicio Excel — `src/services/admin-polls-excel.service.ts` (nuevo)

- Usa `writeExcelFile` de `src/lib/excel.ts` (ExcelJS, NUNCA xlsx).
- 3 hojas: Respuestas detalladas / Resumen por encuesta / Conteo por opción.
- Headers i18n (acepta `t` como param o usa keys hardcoded en español por convención del módulo admin).
- Batching: si total respuestas > 1000, traer en chunks (límite Supabase).
- Filename: `Encuestas_{event_code}_{YYYY-MM-DD}.xlsx`.

#### 7. i18n — claves nuevas

`src/locales/{es,en}/admin.json`:
- `polls.exportAll`, `polls.exportSingle`, `polls.exporting`, `polls.exportSuccess`, `polls.exportError`
- `polls.openTextResponses`, `polls.openTextEmpty`
- `polls.excel.sheetDetailed`, `polls.excel.sheetSummary`, `polls.excel.sheetCounts`
- `polls.excel.col.*` (12 columnas)

`src/locales/{es,en}/common.json`:
- `polls.malformed`, `polls.multiSelectHint`, `polls.duplicateVote`

#### 8. Archivos a tocar (orden backend-first)

1. Migración SQL (poblar + trigger + UNIQUE parcial)
2. `src/services/polls.service.ts` — array de option_ids
3. `src/services/admin-polls.service.ts` — método getAllResponsesForExport
4. `src/services/admin-polls-excel.service.ts` (NUEVO)
5. `src/hooks/usePolls.ts` — N inserts
6. Hook nuevo `useAdminPollTextResponses` (o inline en ResultsModal con useQuery)
7. `src/pages/attendee/Polls.tsx` — RatingForm + ChoiceForm
8. `src/pages/admin/Polls.tsx` — botones export + ResultsModal open_text
9. `src/components/admin/polls/NewPollModal.tsx` — ocultar opciones rating_scale
10. `src/components/admin/polls/ImportPollsModal.tsx` — validación rating_scale sin opciones
11. `src/locales/{es,en}/{admin,common}.json`

#### 9. Verificación post-fix (12 puntos)

| # | Prueba | Criterio |
|---|---|---|
| 1 | Query opciones rating_scale | Cada poll = 5 filas |
| 2 | Crear rating_scale nuevo | Trigger genera 5 opciones |
| 3 | Votar la encuesta del bug | Inserta UUID real, sin error |
| 4 | Votar 2 opciones multiple_choice | 2 filas con mismo attendee_id+poll_id |
| 5 | Votar 2 veces single_choice | Falla por UNIQUE parcial |
| 6 | Abrir results open_text en admin | Lista con autor + fecha + texto |
| 7 | Click "Exportar respuestas" | Descarga .xlsx 3 hojas |
| 8 | Click "Exportar esta encuesta" | Descarga .xlsx del poll |
| 9 | Regresión single_choice existentes | Resultados intactos |
| 10 | `supabase--linter` post-migración | 0 nuevos warnings |
| 11 | **Mobile 360px:** votar multiple en móvil | Touch targets ≥44px, sin overflow |
| 12 | **Dark mode:** ver ResultsModal y formularios | Contraste correcto, sin texto invisible |

#### 10. Riesgos y mitigaciones

- **Riesgo:** `UNIQUE(poll_id, attendee_id)` rompe multiple_choice. **Mitigación:** índice parcial `WHERE option_id IS NOT NULL AND poll_id IN (SELECT id FROM polls WHERE poll_type IN ('single_choice','rating_scale','open_text'))` — o validar a nivel app en multiple_choice.
- **Riesgo:** export con miles de respuestas tarda y bloquea UI. **Mitigación:** botón con estado `isExporting`, batching en service.
- **Riesgo:** trigger duplica opciones si admin las crea manualmente para rating_scale. **Mitigación:** trigger con `IF NOT EXISTS` check.

### Veredicto de la revisión

El plan original cubre la funcionalidad pero le faltaban **6 chequeos de buenas prácticas** del knowledge base: mobile-first, dark mode, skeleton states, TanStack Query, tipos estrictos y batching de exportación. Plan ahora completo y alineado con LL-001/LL-002/backend-first/ExcelJS.

