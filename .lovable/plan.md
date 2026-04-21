

## Plan — Fix error "Error al asignar asistente" en Logística

### Causa raíz (confirmada en logs de Postgres)

```
new row for relation "attendee_services" violates check constraint "attendee_services_status_check"
```

El servicio `adminLogisticsService.assignAttendee()` (línea 208) inserta `status: 'scheduled'`, pero el check constraint de la tabla `attendee_services` solo permite:

```
'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
```

`'scheduled'` **no está en la lista** → toda inserción falla, tanto individual como masiva.

### Por qué pasó
En el cambio reciente del módulo Logística agregamos `effective_status = 'scheduled'` en la vista `service_catalog_with_status` (correcto, refleja el estado del servicio en sí). Pero por error replicamos ese mismo valor al insertar en `attendee_services`, que es otra tabla con su propio dominio de estados.

### Solución (1 línea)

**`src/services/admin-logistics.service.ts`** — método `assignAttendee` (línea 204-211):

Cambiar:
```ts
status: 'scheduled',
```
por:
```ts
status: 'pending',
```

`'pending'` es el estado natural inicial: el asistente queda asignado al servicio pero aún no ha sido validado/usado. Coincide con el resto del flujo (cuando se usa el ticket pasa a `'completed'`, cuando se cancela a `'cancelled'`).

### Verificación posterior
1. Reasignar individualmente desde `/admin/logistics/{id}/assign` → debe mostrar toast de éxito.
2. Asignar masivamente (modo "confirmed" o "all") → debe mover los 590 registros sin errores.
3. Confirmar en la tabla que aparecen con badge "Pendiente" (amber).

### Archivos a modificar
| Archivo | Cambio |
|---|---|
| `src/services/admin-logistics.service.ts` | Línea 208: `'scheduled'` → `'pending'` |

### Sin cambios en
- Base de datos / RLS / triggers (el constraint actual es correcto, no hay que tocarlo).
- UI / modales / hooks.
- i18n.
- Lógica de cancelación, reactivación, validación de tickets — todas ya usan estados válidos.

### Esfuerzo
~30 segundos. Una sola línea.

