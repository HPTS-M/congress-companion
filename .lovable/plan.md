

## Plan — Mejoras de auditoría: bulk regenerate

### Objetivo
Corregir el bug que impide enviar correos, separar correctamente los contadores de éxito/error, y agregar resiliencia para que un cierre accidental de la pestaña no obligue a empezar desde cero.

---

### Cambios

#### 1) Fix crítico: regex de email (Edge Function)
**Archivo**: `supabase/functions/bulk-regenerate-access-codes/index.ts`, línea 197

Cambiar:
```typescript
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;  // ❌ rompe todos los emails
```
por:
```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;     // ✅ válido
```

**Impacto**: actualmente 100% de los correos se están saltando con `reason: 'invalid_email'`. Tras el fix, los correos se enviarán normalmente.

#### 2) Separar contadores: códigos vs correos
**Archivo**: `supabase/functions/bulk-regenerate-access-codes/index.ts`, líneas 199-330

Reemplazar los contadores `processed` / `failed` por una estructura más clara:

```typescript
{
  codes_regenerated: number,   // updates DB exitosos
  emails_sent: number,         // 200 OK de Resend
  emails_skipped: number,      // sin email / email inválido / send_email=false
  emails_failed: number,       // 4xx/5xx de Resend
  db_failed: number,           // error de update en attendees
  total: number,
  next_offset: number,
  remaining: number,
  errors: Array<{ attendee_id, reason }>
}
```

Lógica corregida:
- Update DB exitoso → `codes_regenerated++`
- Resend 200 → `emails_sent++`
- Resend 4xx/5xx → `emails_failed++` (ya no `processed++`)
- Email inválido / sin email → `emails_skipped++`
- Update DB falla → `db_failed++` (no se cuenta como código regenerado)

#### 3) Frontend: mostrar el resumen detallado
**Archivos**:
- `src/services/admin-attendees.service.ts` — agregar nuevos campos al tipo de retorno y agregar contadores entre lotes.
- `src/components/admin/attendees/BulkRegenerateModal.tsx` — actualizar el bloque `summary` para mostrar las 4 métricas (códigos regenerados, correos enviados, correos fallidos, omitidos) con iconos y colores apropiados.

Ejemplo del nuevo resumen en UI:
```
✅ 810 códigos regenerados
📧 808 correos enviados
⚠️  2 correos fallidos (descargar CSV)
⏭️  0 omitidos
```

Compatibilidad hacia atrás: mantener `processed` y `failed` como campos derivados para no romper otros consumidores.

#### 4) Persistencia del progreso en localStorage
**Archivo**: `src/components/admin/attendees/BulkRegenerateModal.tsx`

- Al iniciar un run: guardar en `localStorage` la clave `bulk-regen-state-{eventId}` con `{ filter, offset, totals, startedAt }`.
- Actualizar tras cada lote.
- Al abrir el modal: si existe un state con `startedAt < 24h` y `remaining > 0`, mostrar banner azul con CTA "Reanudar desde X de Y" o "Empezar de nuevo".
- Limpiar el state al completar exitosamente o al cancelar explícitamente.

#### 5) Throttling configurable + más rápido por defecto
**Archivo**: `supabase/functions/bulk-regenerate-access-codes/index.ts`

Bajar `EMAIL_DELAY_MS` de 500ms a 200ms (5/seg, dentro de los límites estándar de Resend). Para 812 asistentes pasamos de ~7 min a ~3 min. Si el plan no lo soporta, el código ya maneja `429 rate_limited` en el log.

#### 6) Traducciones
**Archivos**: `src/locales/es/admin.json` y `src/locales/en/admin.json`

Agregar nuevas keys bajo `attendees.bulkRegenerate.*`:
- `summaryCodesRegenerated`, `summaryEmailsSent`, `summaryEmailsFailed`, `summaryEmailsSkipped`
- `resumeBanner`, `resumeButton`, `startOverButton`

---

### Lo que NO se cambia
- Esquema de DB (no requerido).
- Auth, validación Zod, throttling fundamental, CORS — ya correctos.
- Plantilla de correo.
- Función `verify-access-code`.
- Función `regenerate-access-code` (single attendee).

---

### Verificación post-fix

1. **Regex fix**: SQL antes/después del próximo run:
   ```sql
   SELECT status, reason, COUNT(*) 
   FROM invitation_send_log 
   WHERE attempted_at > now() - interval '1 hour'
   GROUP BY status, reason;
   ```
   Esperado tras fix: `status='sent'` debe ser >0, no todo `skipped/invalid_email`.

2. **Resumen UI**: tras un run, el modal debe mostrar 4 métricas separadas, no solo "procesados/fallidos".

3. **Persistencia**: cerrar pestaña a mitad del run → reabrir modal → debe ofrecer reanudar desde el offset guardado.

4. **Throttling**: 50 correos en ~10s wall-clock (vs ~25s antes).

---

### Archivos a modificar

- `supabase/functions/bulk-regenerate-access-codes/index.ts` — regex, contadores, throttle.
- `src/services/admin-attendees.service.ts` — tipos + agregación de nuevas métricas entre lotes.
- `src/components/admin/attendees/BulkRegenerateModal.tsx` — resumen detallado + persistencia localStorage + banner reanudar.
- `src/locales/es/admin.json` y `src/locales/en/admin.json` — nuevas keys.

