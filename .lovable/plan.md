

## Plan: Mejoras de selección y envío masivo de credenciales

### Estado actual (ya existe)
- Checkbox por fila + "Select all N" en `AttendeesTable` + `Attendees.tsx`.
- Bulk action bar con "Enviar credenciales" y "Eliminar".
- `sendInvitations()` llama al edge function `send-invitation-email` con array de IDs.
- Respuesta: `{ sent, failed }` mostrada en toast simple.

### Problemas detectados (mejores prácticas faltantes)
1. **Sin confirmación explícita** — un click envía emails reales a N personas. Acción irreversible sin diálogo.
2. **Sin preview de destinatarios** — el admin no ve a quién va antes de enviar.
3. **No filtra inválidos en cliente** — selecciona cancelados/sin email y el backend falla silencioso (solo cuenta `failed: N`).
4. **Sin detalle de fallos** — toast dice "3 fallaron" sin decir cuáles ni por qué.
5. **Sin protección contra reenvío rápido** — si el admin hace click 2 veces seguidas, se duplican emails.
6. **Sin distinción entre "primera invitación" y "reenvío"** — útil para que el admin sepa qué está haciendo.

---

### Cambios propuestos

#### 1. Modal de confirmación con preview (`BulkSendCredentialsModal.tsx` nuevo)
Reemplaza el `handleBulkSendCredentials` directo. Al hacer click en "Enviar credenciales":

- Modal se abre con:
  - **Resumen**: "Enviarás credenciales a X asistentes"
  - **Desglose automático** (computado en cliente desde `selectedIds` + `attendees`):
    - ✓ Listos para enviar (activos + con email válido) → **N**
    - ⚠ Ya invitados antes (`invitation_sent_at IS NOT NULL`) → **N** (reenvío)
    - ✗ Excluidos automáticamente:
      - Sin email → N
      - Cancelados → N
  - **Lista expandible** de los primeros 10 destinatarios (nombre + email), "ver todos" muestra el resto.
  - **Checkbox**: "Reenviar también a quienes ya recibieron invitación" (default: off → solo envía a los que nunca fueron invitados).
  - Botones: `Cancelar` / `Enviar a N asistentes` (botón primario muestra el conteo final).

#### 2. Validación y filtrado en cliente antes de mutate
```typescript
const validIds = Array.from(selectedIds).filter(id => {
  const a = attendees.find(x => x.id === id);
  return a && a.registration_status !== 'cancelled' && a.email?.includes('@');
});
```
Solo envía `validIds` al edge function.

#### 3. Toast detallado post-envío
- Éxito completo (`failed === 0`): toast verde con `sent`.
- Éxito parcial: toast warning con `sent` + `failed` y botón "Ver detalle" que abre modal con la lista de IDs/emails que fallaron (si el edge function los devuelve — verificar respuesta actual).
- Verificar si `send-invitation-email` ya devuelve detalle de fallos; si no, ampliarlo para devolver `failures: [{attendee_id, reason}]`.

#### 4. Protección contra doble envío
- Modal se cierra inmediatamente al confirmar (`onClick`) y mutación queda `isPending` con loader.
- Botón "Enviar credenciales" en bulk bar queda disabled mientras `sendInvitationsMutation.isPending`.
- Limpiar `selectedIds` solo tras confirmación exitosa de envío.

#### 5. Mejora visual del bulk bar (menor)
- Agregar icono de avatar agrupado para reforzar "selección múltiple".
- Mostrar contador en el botón: `Enviar credenciales (12)` en vez de solo "Enviar credenciales".

#### 6. Edge function — verificación
Revisar `supabase/functions/send-invitation-email/index.ts` para confirmar:
- Que devuelva detalle de fallos por ID, no solo conteo agregado.
- Si no lo hace, ampliar respuesta a `{ sent, failed, failures: [{attendee_id, email, reason}] }`.

---

### Archivos tocados
1. **Nuevo**: `src/components/admin/attendees/BulkSendCredentialsModal.tsx` — modal con preview + desglose + reenvío opcional.
2. `src/pages/admin/Attendees.tsx` — reemplazar `handleBulkSendCredentials` por apertura de modal.
3. `src/services/admin-attendees.service.ts` — actualizar tipo de respuesta de `sendInvitations` si edge function expone fallos.
4. `supabase/functions/send-invitation-email/index.ts` — (si aplica) devolver detalle de fallos.
5. `src/locales/{es,en}/admin.json` — nuevas keys: `bulkSendModal.title`, `.summary`, `.readyToSend`, `.alreadyInvited`, `.excludedNoEmail`, `.excludedCancelled`, `.resendToggle`, `.confirmButton`, `.partialSuccess`, etc.

### Mejores prácticas aplicadas
- **Confirmación explícita** para acciones destructivas/irreversibles (envío masivo de email = irreversible).
- **Preview antes de actuar** — el admin ve exactamente qué pasa.
- **Validación cliente** — no enviar al backend lo que sabemos que va a fallar.
- **Idempotencia voluntaria** — opt-in para reenvío evita spam accidental.
- **Feedback granular** — éxito vs éxito parcial vs error total tienen tratamiento distinto.
- **Disable + spinner** durante mutación previene doble click.

