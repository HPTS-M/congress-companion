

## Auditoría de la entrega — Envío masivo de credenciales

### ✅ Implementado correctamente

| Área | Estado | Detalle |
|---|---|---|
| Modal de confirmación | ✅ | `BulkSendCredentialsModal.tsx` con desglose, preview, toggle reenvío |
| Validación cliente | ✅ | Filtra cancelados + email inválido vía regex antes de enviar |
| Toggle de reenvío opt-in | ✅ | Default OFF — previene spam accidental |
| Preview con paginación | ✅ | Muestra primeros 10, "ver todos" expande |
| Protección doble-click | ✅ | `disabled={isSending}` + spinner + cierre bloqueado durante send |
| Feedback granular | ✅ | Toast distingue éxito total vs parcial vs error |
| Conteo en botón | ✅ | `Enviar Credenciales (12)` |
| i18n completa | ✅ | 14 keys nuevas en es/en, paridad total |
| Reset de selección | ✅ | `setSelectedIds(new Set())` solo tras éxito |
| Edge function ya devuelve detalle | ✅ | `errors: [{id, error}]` (no requirió cambios) |
| Tipo de respuesta tipado | ✅ | `SendInvitationsResult` con `failed`, `sent`, `errors?` |

### 🟡 Hallazgos a corregir (mejoras de robustez, no bloqueantes)

**H1 · `selectedAttendees` solo incluye los visibles en la página filtrada (BUG sutil)**
En `Attendees.tsx` línea 548:
```tsx
selectedAttendees={displayedAttendees.filter((a) => selectedIds.has(a.id))}
```
Si el admin usa "Select all N" (línea 438 → selecciona todo el dataset filtrado) y luego cambia el filtro o navega de página, `displayedAttendees` puede no contener todos los IDs seleccionados. El modal entonces muestra un desglose **incompleto** (faltan los que ya no están en la vista actual).

**Fix:** mantener un map `id → attendee` global o consultar por IDs antes de abrir el modal. Alternativa simple: en `handleBulkSendCredentials` snapshot de los attendees seleccionados desde una fuente más amplia (ej. cachear en estado local al confirmar selección).

**H2 · Validación de email duplicada entre cliente y modal**
La regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` está hardcodeada en el modal. Existe ya validación de email en `NewAttendeeModal` y validators de import. Extraer a `src/lib/validators.ts` (función `isValidEmail`) para una sola fuente de verdad.

**H3 · El edge function no filtra cancelados ni emails inválidos en el backend**
La validación está solo en el cliente. Si alguien llama el edge function directo, podría intentar enviar a cancelados. Agregar en `send-invitation-email/index.ts` (líneas 124-147) un filtro tras `attendees fetch`:
```typescript
const eligible = attendees.filter(a => 
  a.registration_status !== 'cancelled' && 
  a.email?.includes('@')
);
```
Y reportar los excluidos en el response (`skipped: number`). Defensa en profundidad.

**H4 · Toast de error parcial muestra solo el primer error**
Línea 200-205 de `Attendees.tsx`:
```tsx
const firstError = result.errors?.[0]?.error;
```
Si fallan 50 emails con razones diferentes, el admin solo ve la primera. **Sugerencia:** agregar acción "Ver detalle" en el toast que abra un modal con la lista completa (ya tenemos los datos en `result.errors`). Patrón similar al `ImportErrorsModal` existente.

**H5 · `useSendInvitations` usa `event!.id` (non-null assertion)**
Línea 282 del hook: si por race condition `event` no está cargado, crashea. Agregar guard:
```typescript
mutationFn: (attendeeIds: string[]) => {
  if (!event?.id) throw new Error('Event not loaded');
  return adminAttendeesService.sendInvitations(attendeeIds, event.id);
}
```

**H6 · Sin rate limiting visible al admin**
El edge function procesa secuencialmente (loop con `await`). Si hay 200 attendees y Resend rate-limita, el modal queda en "Enviando..." mucho tiempo sin feedback de progreso. **Sugerencia opcional:** mostrar progreso (`X de N enviados…`) — requiere streaming o polling, más complejo. Aceptable diferir si el volumen típico es <50.

**H7 · No hay registro auditable de quién envió el bulk**
El edge function no inserta en ninguna tabla de auditoría. Para compliance médico (HIPAA-like), registrar en `email_send_log` o tabla nueva `bulk_send_audit` (admin_id, event_id, attendee_count, timestamp). Diferir si no es requisito legal.

### 🟢 Cambios mínimos recomendados (esta iteración)

Aplicar **H1**, **H3**, **H5** — son de robustez sin agregar superficie nueva:

1. **`Attendees.tsx`**: snapshot de attendees seleccionados al abrir modal en estado local (`selectedSnapshot`) para evitar perder filas tras cambiar filtro/página.
2. **`supabase/functions/send-invitation-email/index.ts`**: filtrar cancelados + sin email antes del loop, devolver `skipped: number`.
3. **`useAdminAttendees.ts`**: guard explícito en `useSendInvitations` para `event?.id`.

**Diferir a futuras iteraciones (no bloquean):** H2 (refactor utilitario), H4 (modal de detalle de errores), H6 (progreso), H7 (auditoría).

### Conclusión

La implementación cumple el plan aprobado y aplica las mejores prácticas centrales (confirmación, preview, validación cliente, opt-in para reenvío, anti doble-click, feedback granular, i18n). Los 3 fixes propuestos (H1, H3, H5) cierran las debilidades de robustez.

