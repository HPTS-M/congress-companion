

El usuario quiere optimizar la UI del módulo Admin → Asistentes. Pide específicamente:
1. Paginar a 10 registros visibles
2. Optimizar los filtros
3. Recomendar buenas prácticas

Reviso el estado actual:
- `usePagination` ya existe y soporta `pageSize`. La página `Attendees.tsx` ya lo usa con `pageSize=10` según el summary.
- `DataTablePagination` ya está implementado con i18n.
- `AttendeesTable` ya está memoizada (filas y badges).
- El search ya tiene `debouncedSearch` (server-side via React Query key).
- Hay tabs por estado (`statusFilter`) + panel de calidad de datos.

Necesito revisar el código real para detectar qué falta vs. qué ya está bien.

Voy a leer `src/pages/admin/Attendees.tsx`, `src/hooks/useAdminAttendees.ts` y verificar qué oportunidades hay realmente.

## Plan: Optimización UI Asistentes — Paginación + Filtros + Buenas Prácticas

### Diagnóstico actual
- ✅ Paginación cliente ya existe (`usePagination`, pageSize=10) — funcional
- ✅ Tabla memoizada (filas + badges)
- ✅ Tabs por estado + búsqueda server-side con debounce
- ❌ Selector de tamaño de página fijo en 10 (sin opción 25/50/100)
- ❌ Filtros no incluyen: especialidad, institución, fecha de registro, con/sin servicios
- ❌ Filtros activos no son visibles como "chips removibles"
- ❌ No hay persistencia de filtros en URL (al recargar se pierden)
- ❌ Search debounce puede ser largo; sin indicador "buscando…"
- ❌ Sin filtro rápido por "calidad de datos" expuesto (sin email, sin especialidad, duplicados)
- ❌ Selección bulk no se conserva al cambiar de página
- ❌ Sin scroll virtual (no necesario con paginación de 10, pero sí en exportación)
- ❌ Mobile (360px): tabs de estado pueden desbordar; búsqueda y bulk bar pueden empujar la tabla

### Cambios propuestos

#### 1. Paginación mejorada
- Mantener default 10, añadir selector `[10, 25, 50, 100]` en el footer junto a `DataTablePagination`.
- Persistir `pageSize` y `currentPage` en `searchParams` de la URL.
- Al cambiar de filtro/búsqueda → reset a página 1 (ya lo hace `usePagination`).

#### 2. Filtros optimizados
**Barra de filtros unificada (sticky bajo el header):**
- Búsqueda con icon spinner cuando `isFetching` (visual feedback durante debounce + query).
- Tabs estado (actuales): Todos / Confirmado / Pendiente / Cancelado.
- **Nuevos filtros desplegables** (Popover con multi-select):
  - Especialidad (lista derivada de attendees del evento)
  - Institución (lista derivada)
  - Tiene servicios (Sí / No / Cualquiera)
  - Calidad de datos (Sin email / Sin especialidad / Email duplicado / Código duplicado)
- **Chips de filtros activos** removibles individualmente, con botón "Limpiar todo".
- **Persistencia en URL** (`?status=pending&specialty=Cardiología&page=2`) — bookmarkable y compartible.

#### 3. Selección bulk persistente
- Mantener `selectedIds` en memoria al paginar (Set global, no resetear al cambiar página).
- Mostrar contador "X seleccionados (de N total)" + opción "Seleccionar todos los N" (no solo los visibles).
- Indicador visual: cuando hay selección oculta en otras páginas.

#### 4. Mejoras de rendimiento
- Mover el filtro de "calidad de datos" del cliente al servidor cuando sea posible (vía RPC o filtros en query).
- Si dataset > 500 attendees, considerar paginación server-side (LIMIT/OFFSET en Supabase) — preparar el hook para soportar ambos modos.
- `staleTime` 60s para counts (ya está), 30s para listado.

#### 5. UX/Accesibilidad
- Estado vacío diferenciado: "Sin resultados con estos filtros" vs "Aún no hay asistentes".
- Botón "Limpiar filtros" en estado vacío.
- `aria-live="polite"` para anunciar cambios de filtro a screen readers.
- Touch targets ≥44px en mobile (botones de filtros, paginación).
- Scroll horizontal interno en tabla (no en página) en mobile.

#### 6. Mobile-first (360px)
- Tabs de estado → scroll horizontal con `overflow-x-auto` y snap.
- Filtros nuevos → consolidados en un único botón "Filtros (3)" que abre `Sheet` con todas las opciones.
- Bulk bar → fixed bottom en mobile (no sticky top).
- Paginación → solo Prev/Next + "X de Y" en mobile.

#### 7. Dark mode
- Verificar contraste de chips de filtros activos (bg-primary/10 + text-primary funciona).
- Skeleton + spinner con `dark:` variants.

### Archivos a tocar
| Archivo | Cambio |
|---|---|
| `src/hooks/usePagination.ts` | Aceptar `pageSize` dinámico vía setter; persistencia opcional |
| `src/hooks/useAdminAttendees.ts` | Aceptar nuevos filtros (specialty, institution, hasServices, quality) |
| `src/pages/admin/Attendees.tsx` | Barra de filtros, chips activos, selector pageSize, URL params |
| `src/components/admin/attendees/AttendeesTable.tsx` | Selección persistente + indicador "ocultas" |
| `src/components/admin/attendees/AttendeesFilters.tsx` (NUEVO) | Componente de filtros + Sheet móvil |
| `src/components/ui/data-table-pagination.tsx` | Añadir prop `pageSize` + `onPageSizeChange` opcional |
| `src/services/admin-attendees.service.ts` | Soportar filtros nuevos en query Supabase |
| `src/locales/{es,en}/admin.json` | Claves nuevas: filtros, chips, "limpiar todo", pageSize, "seleccionar todos los N" |

### Buenas prácticas incluidas
1. **URL como fuente de verdad** para filtros (compartible, refrescable).
2. **Selección bulk persistente entre páginas** con contador real.
3. **Filtros derivados del dataset** (no hardcoded) — escalable.
4. **Server-side filtering** con índices en columnas filtrables.
5. **Debounce visible** con spinner — feedback inmediato.
6. **Chips removibles** — patrón estándar de data tables (Linear, Notion, Airtable).
7. **Estado vacío contextual** según causa (sin datos vs sin resultados).
8. **Mobile-first**: filtros consolidados en Sheet, paginación simplificada.
9. **i18n**: cero hardcoded strings.
10. **TanStack Query**: queryKey incluye todos los filtros para cache automático.
11. **Accesibilidad**: aria-live, touch targets ≥44px.
12. **Dark mode** completo.

### Verificación post-cambios
| # | Prueba | Criterio |
|---|---|---|
| 1 | Paginar con 10/25/50/100 | Conserva selección bulk |
| 2 | Aplicar 3 filtros + recargar página | Filtros persisten via URL |
| 3 | Buscar "claudia" mientras carga | Spinner visible en input |
| 4 | Filtro por especialidad | Resultados correctos, chip removible |
| 5 | Seleccionar todos los N (no solo visibles) | Bulk delete afecta todos |
| 6 | Mobile 360px: abrir filtros | Sheet con todas las opciones, touch ≥44px |
| 7 | Dark mode: chips + skeleton | Contraste OK |
| 8 | Estado vacío con filtros | Botón "Limpiar filtros" funcional |
| 9 | Navegación con teclado | Tab/Enter en filtros y paginación |
| 10 | `supabase--linter` post-cambios | 0 nuevos warnings (si tocamos service) |

### Entregable
Reporte ✅/❌ de los 10 puntos + screenshots desktop/mobile/dark mode.

