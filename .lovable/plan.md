

El usuario quiere ejecutar primero el diagnóstico (read-only) sin aplicar correcciones aún. En modo plan tengo `supabase--read_query` disponible. Voy a planificar solo la fase de diagnóstico.

## Plan: Diagnóstico de Calificaciones

### Objetivo

Identificar la causa exacta de por qué el reporte admin muestra "Aún no hay calificaciones" pese a que el asistente ya calificó 4 sesiones. **Sin modificar nada.**

### Queries a ejecutar (solo lectura)

1. **Verificar existencia de filas en `ratings`** para el evento ACQFH-2026:
```sql
SELECT r.id, r.event_id, r.user_id, r.session_id, r.stars, 
       r.comment, r.created_at,
       a.full_name, a.credential_code, a.email,
       ea.title AS session_title
FROM ratings r
LEFT JOIN attendees a ON a.id = r.user_id
LEFT JOIN event_activities ea ON ea.id = r.session_id
WHERE r.event_id = (SELECT id FROM events WHERE event_code = 'ACQFH-2026')
ORDER BY r.created_at DESC;
```

2. **Inspeccionar políticas RLS de `ratings`** (la tabla no apareció en el contexto de tablas — sospecha alta de RLS faltante o restrictiva):
```sql
SELECT policyname, cmd, roles, permissive, qual, with_check
FROM pg_policies 
WHERE tablename = 'ratings' AND schemaname = 'public';
```

3. **Verificar GRANTS y RLS habilitado**:
```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'ratings';

SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'ratings' AND table_schema = 'public';
```

4. **Confirmar esquema real de `ratings`** (columnas, tipos, defaults):
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'ratings' AND table_schema = 'public'
ORDER BY ordinal_position;
```

### Interpretación esperada

| Hallazgo | Causa raíz | Próxima fase |
|---|---|---|
| Hay filas + sin política SELECT para admin | RLS bloqueando lectura admin | Migración: agregar políticas admin/superuser + `block_anon` |
| Hay filas + política existe pero `qual` mal escrita | Política rota | Migración: corregir `qual` |
| No hay filas en BD | Inserts fallando silenciosamente o `event_id` distinto | Revisar `ratingsService.upsertRating` y logs |
| Falta GRANT SELECT a `authenticated` | Permisos a nivel tabla | Migración: `GRANT SELECT ... TO authenticated` |
| Esquema no tiene `event_id` correcto en filas | Bug de inserción | Corregir servicio |

### Entregable

Tras ejecutar las 4 queries reportaré:
- Conteo real de calificaciones del evento.
- Lista de políticas RLS actuales.
- Diagnóstico definitivo (cuál de las 4 hipótesis aplica).
- Propuesta concreta de remediación para que la apruebes en un segundo plan.

**No se modifica nada en esta fase.**

