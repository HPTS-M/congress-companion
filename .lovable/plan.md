

## Plan — Eliminar servicios con tickets asignados sin error

### Diagnóstico (verificado en BD)

Al intentar eliminar un servicio (`service_catalog`) que tiene asignados (`attendee_services`), Postgres lanza **foreign key violation (23503)** porque la FK `fk_service_catalog` **NO tiene `ON DELETE CASCADE`**.

```
attendee_services.service_catalog_id  → service_catalog(id)   [NO CASCADE] ❌
provider_services.service_catalog_id  → service_catalog(id)   [CASCADE] ✅
service_tickets.attendee_service_id   → attendee_services(id) [CASCADE] ✅
```

**Estado real verificado:**
- "Almuerzo Día 1": 2 asignados → DELETE falla con 23503.
- "desayuno 3", "Prueba", "Tour Comuna 13": 0 asignados → DELETE debería funcionar; el toast "Error al eliminar servicio" visible probablemente proviene de un intento previo sobre un servicio con asignados (Sonner mantiene el toast unos segundos).

Además, el código actual:
- `Logistics.tsx:124` usa `catch {}` sin diferenciar el tipo de error → siempre muestra el mismo mensaje genérico.
- `admin-logistics.service.ts:remove()` no detecta el caso 23503 ni explica al usuario qué hacer.

---

### Solución (3 capas coordinadas)

#### Capa 1 — Migración de BD: añadir `ON DELETE CASCADE` a la FK faltante

`supabase/migrations/<timestamp>_cascade_attendee_services_on_catalog_delete.sql`

```sql
ALTER TABLE public.attendee_services
  DROP CONSTRAINT fk_service_catalog;

ALTER TABLE public.attendee_services
  ADD CONSTRAINT fk_service_catalog
  FOREIGN KEY (service_catalog_id)
  REFERENCES public.service_catalog(id)
  ON DELETE CASCADE;
```

**Efecto:** al borrar un servicio del catálogo, sus `attendee_services` se borran automáticamente, y por el cascade existente en `service_tickets.attendee_service_id` los tickets también se eliminan en la misma transacción. Nada queda huérfano.

#### Capa 2 — Servicio: detectar 23503 y lanzar error tipado

`src/services/admin-logistics.service.ts` — método `remove()`:

```ts
async remove(id: string): Promise<void> {
  const { error } = await supabase.from('service_catalog').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') throw new Error('SERVICE_HAS_DEPENDENCIES');
    throw new Error(error.message);
  }
},
```

(Defensa en profundidad por si en algún entorno el cascade aún no se aplicó.)

#### Capa 3 — UI: confirmación contextual + manejo de error específico

`src/pages/admin/Logistics.tsx`:

1. **Diálogo de confirmación de borrado**: cuando el servicio tiene `total_tickets > 0`, mostrar texto adicional advirtiendo que se eliminarán también los tickets de los X asignados. Para esto, cambiar `deletingId: string | null` por `deleting: ServiceCatalogRow | null` para tener acceso al servicio completo.

2. **Manejar error específico** en `handleDelete`:
```ts
} catch (err: any) {
  if (err?.message === 'SERVICE_HAS_DEPENDENCIES') {
    toast.error(t('logistics.deleteHasDependenciesError'));
  } else {
    toast.error(t('logistics.deleteError'));
  }
}
```

3. **Nuevas claves i18n** en `src/locales/es/admin.json` y `src/locales/en/admin.json`:
```json
"logistics": {
  "deleteConfirmWithAssignees": "Este servicio tiene {{count}} asignación(es). Al eliminarlo se borrarán también todas sus asignaciones y tickets. ¿Continuar?",
  "deleteHasDependenciesError": "No se pudo eliminar el servicio por dependencias. Intenta nuevamente.",
}
```

---

### Verificación post-fix

1. Eliminar "Almuerzo Día 1" (2 asignados) → diálogo advierte de los 2 asignados → confirmar → toast verde, tabla actualiza, BD: servicio + 2 attendee_services + sus tickets eliminados.
2. Eliminar "desayuno 3" (0 asignados) → diálogo simple → confirmar → toast verde.
3. Cancelar diálogo → no pasa nada.
4. Si por algún motivo la migración no corrió (caso defensivo): toast rojo específico "No se pudo eliminar por dependencias".

---

### Lo que NO se toca

- `useAdminLogistics.ts` — patrón de mutation actual es correcto.
- RLS policies de `service_catalog` — ya permiten admin DELETE vía `Admins manage org service catalog`.
- `cancelService` / `reactivateService` — sin cambios.
- `provider_services` — ya tiene cascade correcto.

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `supabase/migrations/<new>.sql` | DROP + ADD constraint con `ON DELETE CASCADE` |
| `src/services/admin-logistics.service.ts` | `remove()` detecta error 23503 y lanza `SERVICE_HAS_DEPENDENCIES` |
| `src/pages/admin/Logistics.tsx` | `deletingId` → `deleting: ServiceCatalogRow \| null`; diálogo con advertencia contextual; toast diferenciado |
| `src/locales/es/admin.json` | 2 claves nuevas (`deleteConfirmWithAssignees`, `deleteHasDependenciesError`) |
| `src/locales/en/admin.json` | mismas 2 claves traducidas |

**Total: 5 archivos, ~25 líneas. Resuelve la causa raíz (FK sin cascade) y mejora la experiencia de usuario.**

