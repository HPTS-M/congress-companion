

## Plan — Backfill SQL atómico de `access_code_lookup` y validación post-update

### Diagnóstico confirmado por la BD
- **812 asistentes** con `access_code_hash` válido.
- **0 con `access_code_lookup`** poblado, a pesar de 1.097 envíos exitosos en las últimas 24h.
- Los `UPDATE` desde la Edge Function escriben hash + `invitation_sent_at` + `updated_at` correctamente, pero **omiten silenciosamente** `access_code_lookup`.
- Solo 8 attendees tienen sesión iniciada; los 804 restantes están bloqueados con `CPU Time exceeded` en `verify-access-code` porque el lookup index no existe.
- No hay triggers responsables — el bug es del lado de PostgREST/cliente Supabase JS (probablemente cache de schema desactualizado o transformación de columna).

### Estrategia
Bypasear completamente la Edge Function y PostgREST con un **RPC SQL atómico** que use bcrypt nativo (`extensions.crypt + gen_salt('bf', 8)`) y haga UPDATE directo dentro de Postgres. Esto elimina toda la cadena de transformaciones que está descartando el campo.

---

### Cambios

#### 1) Migración SQL: nuevo RPC `backfill_access_codes_for_event`
```sql
CREATE OR REPLACE FUNCTION public.backfill_access_codes_for_event(
  p_event_id uuid,
  p_only_missing_lookup boolean DEFAULT true
)
RETURNS TABLE(attendee_id uuid, full_name text, email text, new_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
BEGIN
  -- Solo superuser o admin de la org del evento
  IF NOT (
    has_role(auth.uid(), 'superuser') OR
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = p_event_id
      AND has_org_role(auth.uid(), 'admin', e.organization_id)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR rec IN
    SELECT a.id, a.full_name, a.email
    FROM attendees a
    WHERE a.event_id = p_event_id
      AND a.deleted_at IS NULL
      AND a.registration_status <> 'cancelled'
      AND (NOT p_only_missing_lookup OR a.access_code_lookup IS NULL)
  LOOP
    -- Generar código de 8 chars
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;

    UPDATE attendees
    SET
      access_code_hash    = extensions.crypt(v_code, extensions.gen_salt('bf', 8)),
      access_code_lookup  = upper(substring(v_code, 1, 4)),
      invitation_sent_at  = now(),
      last_session_id     = NULL,
      updated_at          = now()
    WHERE id = rec.id;

    attendee_id := rec.id;
    full_name   := rec.full_name;
    email       := rec.email;
    new_code    := v_code;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_access_codes_for_event TO authenticated;
```

#### 2) Edge Function `bulk-regenerate-access-codes` — validación post-UPDATE
Agregar tras cada `UPDATE`:
```typescript
// Verifica que access_code_lookup quedó realmente guardado
const { data: check } = await supabaseAdmin
  .from('attendees')
  .select('access_code_lookup')
  .eq('id', a.id)
  .single();

if (!check?.access_code_lookup) {
  db_failed++;
  errors.push({ attendee_id: a.id, reason: 'lookup_not_persisted' });
  continue;
}
codes_regenerated++;
```
Esto evita que el bug silencioso vuelva sin ser detectado.

#### 3) Servicio frontend: `backfillAccessCodesViaRpc`
Archivo: `src/services/admin-attendees.service.ts`
```typescript
async backfillAccessCodesViaRpc(eventId: string, onlyMissing = true) {
  const { data, error } = await supabase.rpc('backfill_access_codes_for_event', {
    p_event_id: eventId,
    p_only_missing_lookup: onlyMissing,
  });
  if (error) throw error;
  return data; // Array<{ attendee_id, full_name, email, new_code }>
}
```

#### 4) Modal `BulkRegenerateModal`: nueva opción "Backfill rápido (recomendado)"
Archivo: `src/components/admin/attendees/BulkRegenerateModal.tsx`

- Agregar 4ª opción al RadioGroup: **"⚡ Backfill rápido — solo a quienes les falta el lookup (recomendado)"** con conteo dinámico (~812 hoy).
- Flujo en dos pasos:
  1. **Paso 1 — Backfill atómico** (RPC, ~5s): regenera hash + lookup para los 812.
  2. **Paso 2 — Envío de correos** (en lotes throttled a 200ms): itera la lista devuelta por el RPC enviando correos con `send-invitation-email` para cada `(attendee_id, new_code)`.
- Progreso UI: "✅ 812 lookups poblados — Enviando correos: 245/812".
- Resumen final reusa el mismo bloque de métricas granulares ya implementado.

#### 5) Traducciones nuevas
`src/locales/es/admin.json` y `en/admin.json`:
- `attendees.bulkRegenerate.filterFastBackfill` — "⚡ Backfill rápido (solo lookup faltante)"
- `attendees.bulkRegenerate.fastBackfillHint` — "Regenera código y lookup en BD en segundos, luego envía correos."
- `attendees.bulkRegenerate.step1Backfilling` — "Poblando lookup en base de datos..."
- `attendees.bulkRegenerate.step2SendingEmails` — "Enviando correos: {{sent}} de {{total}}"

---

### Verificación post-implementación

1. **Backfill exitoso**:
   ```sql
   SELECT COUNT(*) FROM attendees
   WHERE event_id = (SELECT id FROM events WHERE event_code = 'ACQFH-2026')
     AND access_code_lookup IS NOT NULL
     AND deleted_at IS NULL;
   ```
   Esperado: **812** (actual: 0).

2. **Login de prueba** con un código nuevo → debe completar en **<500ms** (vs. actual `CPU Time exceeded`).

3. **Logs Edge Function `verify-access-code`** → 0 timeouts en las próximas horas.

4. **Validación post-update activa**: si la Edge Function `bulk-regenerate-access-codes` se vuelve a usar, `db_failed` se incrementará si el lookup no persiste, alertando al admin.

---

### Plan de rollout para los 812 asistentes bloqueados

1. Aplicar migración con el RPC.
2. Admin entra a Asistentes → "Regenerar códigos" → selecciona **"⚡ Backfill rápido"**.
3. Paso 1 termina en ~5 segundos → 812 lookups poblados.
4. Paso 2 envía 812 correos en ~3 minutos (throttle 200ms).
5. Asistentes pueden loguearse instantáneamente con el nuevo código.

---

### Lo que NO se cambia
- Esquema de columnas (ya existen `access_code_hash`, `access_code_lookup`).
- Índice parcial sobre `(event_id, access_code_lookup)` (ya existe).
- Función `verify-access-code` (ya optimizada — solo necesita los lookups poblados).
- `regenerate-access-code` (single attendee).
- Plantilla de correo (`send-invitation-email`).

---

### Archivos a crear/modificar

**Nuevos:**
- Migración SQL con `backfill_access_codes_for_event`.

**Modificados:**
- `supabase/functions/bulk-regenerate-access-codes/index.ts` — validación post-UPDATE.
- `src/services/admin-attendees.service.ts` — método `backfillAccessCodesViaRpc`.
- `src/components/admin/attendees/BulkRegenerateModal.tsx` — opción "⚡ Backfill rápido" con flujo de 2 pasos.
- `src/locales/es/admin.json` y `en/admin.json` — strings nuevas.

