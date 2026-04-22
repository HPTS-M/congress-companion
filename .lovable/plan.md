

## Plan — Opción B: Backfill perezoso para escalar el login a 814+ asistentes

### Objetivo
Resolver el error `CPU Time exceeded` en `verify-access-code` sin reenviar credenciales a nadie. La solución agrega un índice ligero sobre los primeros 4 caracteres del access code; los asistentes existentes se "auto-curan" al primer login exitoso.

### Cambios

#### 1) Migración de base de datos
Agregar columna + índice en `attendees`:

```sql
ALTER TABLE public.attendees
  ADD COLUMN access_code_lookup TEXT;

CREATE INDEX idx_attendees_event_lookup
  ON public.attendees (event_id, access_code_lookup)
  WHERE access_code_lookup IS NOT NULL AND deleted_at IS NULL;
```

- Columna nullable → no rompe asistentes existentes.
- Índice parcial → solo indexa los que ya tienen lookup, ahorra espacio.
- No expuesta al cliente (RLS actual ya filtra columnas vía `select()` explícito en el backend).

#### 2) `supabase/functions/verify-access-code/index.ts`
Cambiar el path de búsqueda con fallback automático:

- **Path rápido (nuevo)**: filtrar por `event_id + access_code_lookup = code.substring(0,4).toUpperCase()` → 1-3 candidatos → bcrypt rápido.
- **Path fallback (existente)**: si el path rápido no encuentra match Y el asistente aún no tiene `access_code_lookup`, hacer scan en lotes paginados de 100 asistentes por iteración (sin RPC), comparando bcrypt sobre cada lote hasta encontrar match o agotar.
- **Auto-curación**: cuando el fallback encuentra match, popular `access_code_lookup` para ese asistente → próximos logins van por path rápido.
- **Escalado**: con 814 asistentes el primer login de cada uno cuesta ~2-4 lotes de bcrypt, dentro del límite de CPU. A medida que se loguean, el universo de "no curados" se reduce.

#### 3) `supabase/functions/send-invitation-email/index.ts`
Al generar nuevo access code, guardar también:
```typescript
access_code_lookup: code.substring(0, 4).toUpperCase()
```
Junto con el `access_code_hash` existente.

#### 4) `supabase/functions/regenerate-access-code/index.ts`
Mismo cambio: popular `access_code_lookup` al regenerar.

### Lo que NO cambia
- Frontend (Login, useAuth, services) — sin tocar.
- Esquema de respuesta de `verify-access-code` — mismo payload.
- Hashing bcrypt — sigue igual (sigue siendo el mecanismo de validación).
- RLS — sin tocar.
- `regenerate-access-code` para asistentes individuales — sigue funcionando.

### Comportamiento esperado tras desplegar

| Escenario | Antes | Después |
|---|---|---|
| Asistente que YA se logueó alguna vez | OK (~1s) | OK (<300ms) — path rápido |
| Asistente que NUNCA se ha logueado (entre los 814) | Timeout | OK (~1s) — path fallback, queda curado |
| Asistente nuevo (post-deploy) | N/A | OK (<300ms) — lookup poblado al crear |
| Asistente con código regenerado | OK | OK — lookup actualizado en regen |

### Plan B si algún caso del fallback aún supera CPU
Si hay un asistente cuyo bcrypt cae siempre al final del scan y excede CPU, el admin puede regenerar su código desde el drawer (un click) → genera código nuevo con `access_code_lookup` poblado → próximo login instantáneo.

### Verificación post-deploy

1. Login del usuario `WRTLH3DT` (o cualquier asistente bloqueado) → debe funcionar en <2s.
2. Consultar en DB que su `access_code_lookup` ya tiene los primeros 4 chars.
3. Logout + login del mismo usuario → debe funcionar en <500ms (path rápido).
4. Revisar logs de `verify-access-code` → no más `CPU Time exceeded`.

### Archivos modificados
- Migración SQL (nueva).
- `supabase/functions/verify-access-code/index.ts`.
- `supabase/functions/send-invitation-email/index.ts`.
- `supabase/functions/regenerate-access-code/index.ts`.

