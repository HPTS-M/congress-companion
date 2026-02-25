

## Diagnóstico confirmado

**Dos problemas encadenados causan los contadores en 0:**

### Problema 1: Recursión infinita en `attendees`

Los logs de Postgres confirman decenas de errores recientes:
```
ERROR: infinite recursion detected in policy for relation "attendees"
```

**Cadena de recursión:**
```text
announcements RLS
  └─ "Authenticated read event announcements"
       └─ subquery: SELECT event_id FROM attendees WHERE user_id = auth.uid()
            └─ attendees RLS evalúa TODAS las políticas PERMISSIVE (OR)
                 └─ "Providers read attendees for assigned services"
                      └─ subquery on attendee_services
                           └─ attendee_services RLS
                                └─ "Attendees can view own services"
                                     └─ subquery: SELECT 1 FROM attendees WHERE...
                                          └─ ← RECURSIÓN INFINITA
```

### Problema 2: `block_anon_access` en announcements es PERMISSIVE

La migración anterior recreó `block_anon_access` como **PERMISSIVE** (verificado con `pg_policy`). Debería ser **RESTRICTIVE** para bloquear `anon` efectivamente.

---

## Plan de migración (1 archivo SQL)

### Paso 1: Crear función SECURITY DEFINER para proveedores

```sql
CREATE OR REPLACE FUNCTION get_provider_attendee_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT aser.attendee_id
  FROM attendee_services aser
  JOIN provider_services ps ON ps.service_catalog_id = aser.service_catalog_id
  JOIN providers p ON p.id = ps.provider_id
  WHERE p.user_id = auth.uid();
$$;
```

Esta función rompe el ciclo: se ejecuta con privilegios de owner, sin evaluar RLS de `attendee_services` ni `attendees`.

### Paso 2: Reemplazar política recursiva en `attendees`

```sql
DROP POLICY "Providers read attendees for assigned services" ON attendees;

CREATE POLICY "Providers read attendees for assigned services"
ON attendees FOR SELECT TO authenticated
USING (id IN (SELECT get_provider_attendee_ids()));
```

### Paso 3: Corregir `block_anon_access` en announcements (RESTRICTIVE)

```sql
DROP POLICY "block_anon_access" ON announcements;

CREATE POLICY "block_anon_access"
ON announcements AS RESTRICTIVE FOR SELECT TO anon
USING (false);
```

### Paso 4: Optimizar announcements para usar `get_my_event_ids()`

```sql
DROP POLICY "Authenticated read event announcements" ON announcements;

CREATE POLICY "Authenticated read event announcements"
ON announcements FOR SELECT TO authenticated
USING (event_id IN (SELECT get_my_event_ids()));
```

Esto evita que el subquery toque `attendees` RLS directamente.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/migrations/XXXXXX_fix_attendees_recursion.sql` | Nueva migración con los 4 pasos |
| Ningún archivo frontend | No se necesitan cambios de código |

## Resultado esperado

- Dashboard "Anuncios enviados": **7**
- Communications "Total anuncios enviados": **7**
- Communications "Asistentes alcanzados": **6** (query a `attendees` ya no causa recursión)
- Logs de Postgres: sin errores de recursión infinita

