

## Plan: Sistema completo de invitaciones de asistentes

Plan aprobado y verificado contra el codigo existente. Implementacion en 8 pasos.

---

### Paso 1: Migracion BD

Agregar columna `invitation_sent_at timestamptz` a la tabla `attendees`.

---

### Paso 2: Edge Function `send-invitation-email`

Nuevo archivo `supabase/functions/send-invitation-email/index.ts`:
- Recibe `{ attendee_ids: string[], event_id: string }`
- Auth: JWT manual + verificacion admin/superuser via `get_user_roles` (patron de `send-email`)
- Service role client para escritura
- Por cada attendee: genera codigo 8 chars (A-Z0-9), hashea con `bcrypt.hashSync`, UPDATE `access_code_hash` + `invitation_sent_at`, envia correo via Resend
- Retorna `{ success, sent, failed }`
- Agregar `[functions.send-invitation-email] verify_jwt = false` a `config.toml`

---

### Paso 3: Modificar `verify-access-code`

Insertar auto-confirmacion en linea ~152, despues de verificar que no esta cancelled y antes de crear/buscar auth user:
```typescript
if (matchedAttendee.registration_status === 'pending') {
  await supabaseAdmin.from('attendees')
    .update({ registration_status: 'confirmed' })
    .eq('id', matchedAttendee.id);
  matchedAttendee.registration_status = 'confirmed';
}
```

---

### Paso 4: Servicio + Hook frontend

- `admin-attendees.service.ts`: nuevo metodo `sendInvitations(attendeeIds, eventId)` que invoca la Edge Function
- `useAdminAttendees.ts`: nuevo hook `useSendInvitations()` con mutation
- Modificar `bulkCreateAttendees` para aceptar `registration_status` como parametro

---

### Paso 5: Modificar `NewAttendeeModal`

- Si estado = "confirmed": despues de crear exitosamente, invocar `sendInvitations([attendee.id], eventId)` y mostrar toast con resultado
- Si estado = "pending": crear sin enviar correo (comportamiento actual)

---

### Paso 6: Modificar `ImportCsvModal`

- Agregar selector de estado (confirmed/pending) antes del boton de importar
- Pasar el estado seleccionado a `bulkCreateAttendees`
- Si "confirmed": despues del bulk insert, invocar `sendInvitations` con los IDs retornados (la funcion ya retorna IDs via `.select('id')` -- necesita modificarse para exponerlos)

---

### Paso 7: Botones en `AttendeeDetailDrawer`

Reemplazar el boton disabled "Send by Email" (linea 172-175) con botones funcionales:
- **"Enviar credenciales"** para confirmed sin `invitation_sent_at`
- **"Reenviar credenciales"** para confirmed con `invitation_sent_at`
- **"Confirmar y enviar"** para pending (cambia estado a confirmed + envia)
- Cada boton invoca `sendInvitations` y muestra feedback

---

### Paso 8: Traducciones en/es

Nuevas claves en ambos `admin.json`:
- `attendees.sendCredentials` / `resendCredentials` / `confirmAndSend`
- `attendees.invitationSent` / `invitationFailed` / `sendingInvitation`
- `attendees.importStatusLabel` / `importStatusConfirmed` / `importStatusPending`
- `attendees.detail.invitationSentAt` / `confirmAndSend`

---

### Archivos modificados

1. `supabase/migrations/XXXXXX_add_invitation_sent_at.sql` (nuevo)
2. `supabase/functions/send-invitation-email/index.ts` (nuevo)
3. `supabase/config.toml` (agregar entrada)
4. `supabase/functions/verify-access-code/index.ts` (auto-confirmacion)
5. `src/services/admin-attendees.service.ts` (sendInvitations + bulkCreate con status)
6. `src/hooks/useAdminAttendees.ts` (useSendInvitations)
7. `src/components/admin/attendees/NewAttendeeModal.tsx` (envio post-creacion)
8. `src/components/admin/attendees/ImportCsvModal.tsx` (selector estado + envio masivo)
9. `src/components/admin/attendees/AttendeeDetailDrawer.tsx` (botones funcionales)
10. `src/locales/en/admin.json` (nuevas claves)
11. `src/locales/es/admin.json` (nuevas claves)

