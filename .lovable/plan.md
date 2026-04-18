

## Diagnóstico

**Estado de los usuarios** (evento ACQFH-2026):

| Usuario | Estado |
|---|---|
| Mauricio Larrea (`larreamauricio10@gmail.com`) | ✅ confirmed, user_id activo |
| DAVID SANGUINO (`sanguino.david@gmail.com`) | ✅ confirmed, user_id activo |

⚠️ Nota: existe un registro duplicado adicional con el email de Mauricio asignado a "Alberto Gonzalez" (deleted, pending) — no afecta la conexión pero es ruido en la BD.

**Solicitudes de contacto existentes** — hay DOS registros pendientes:
1. Mauricio → David · `pending` · creada 17-abr 23:58
2. David → Mauricio · `pending` · creada 18-abr 00:22

Las dos solicitudes existen en la BD. El problema NO es de datos, es de **visibilidad UI**.

## Causa raíz

`Contacts.tsx` separa las solicitudes pendientes en dos buckets, pero solo muestra al usuario un único bucket. Revisando el patrón típico:

- **"Recibidas"** (`contact_id = miAttendeeId`) → se muestran con botones Aceptar/Rechazar
- **"Enviadas"** (`user_id = miAttendeeId`) → frecuentemente NO se renderizan en ninguna pestaña → "no las veo en ningún lado"

Resultado: cada usuario ve la solicitud que recibió del otro (o ninguna si la lógica de filtrado las excluye), pero no la que ÉL envió. Y como ambos enviaron solicitud cruzada antes de aceptar, el sistema queda en limbo: dos solicitudes pendientes opuestas que nunca se auto-resuelven.

Además, la política RLS `Authenticated update contacts` solo permite actualizar a `contact_id IN get_my_attendee_ids()` → solo el **receptor** puede aceptar, no el emisor. Entonces aunque vieran la solicitud enviada, no podrían "auto-aceptarla".

## Plan

**1. Fix de datos inmediato** (resuelve el caso actual de Mauricio ↔ David)

Auto-aceptar ambas solicitudes ya que hay intención mutua confirmada (ambos enviaron):

```sql
UPDATE contacts
SET status = 'accepted', connected_at = now()
WHERE id IN ('9fe55e03-8a90-4471-9808-40054814337e',
             '5a847b20-c262-4e0c-af9e-82f5431b1f95');
```

**2. Fix de UI en `src/pages/attendee/Contacts.tsx`**

Dentro de la pestaña "Mis Contactos", agregar tres secciones claras:
- **Solicitudes recibidas** (`pending` donde `contact_id = miId`) — con botones Aceptar / Rechazar
- **Solicitudes enviadas** (`pending` donde `user_id = miId`) — con badge "Enviado" + botón Cancelar (delete)
- **Conexiones** (`accepted`)

Hoy probablemente solo existe la primera y la tercera.

**3. Fix de lógica en el servicio / hook de envío de solicitudes**

En `useSendContactRequest` (o `contactsService.sendRequest`), antes de insertar:
- Verificar si ya existe una solicitud `pending` del otro lado (`user_id = targetId AND contact_id = miId`)
- Si existe → en lugar de crear una nueva, **aceptarla automáticamente** (auto-match cuando ambos quisieron conectar). Esto requiere ampliar la política RLS o usar un RPC `SECURITY DEFINER` `accept_or_create_contact(_target_id)` ya que el emisor original es quien debe ejecutar el UPDATE en la fila opuesta.

**4. RPC nuevo recomendado** (para el punto 3)

```sql
CREATE FUNCTION accept_or_create_contact(_event_id uuid, _target_attendee_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER ...
-- Si hay pending inverso → UPDATE a accepted
-- Si no → INSERT pending
```

### Resultado esperado
- Mauricio y David quedan conectados ahora mismo.
- En el futuro, si dos asistentes se mandan solicitud cruzada, se conectan automáticamente.
- Los usuarios siempre ven el estado de sus solicitudes enviadas (badge "Enviado") y pueden cancelarlas.

