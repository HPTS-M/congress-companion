

## Plan: Flujo de invitaciones controlado por admin (Opción B)

### Flujo

```text
Admin crea asistente ──► Estado "Pendiente" ──► Sin email
                                                    │
                                     Admin presiona "Enviar credenciales"
                                     (individual o masivo)
                                                    │
                                                    ▼
                                          Se envía email con código
                                                    │
                                                    ▼
                                       Asistente ingresa código
                                                    │
                                                    ▼
                                       Estado cambia a "Confirmado"
                                       (auto, en verify-access-code)
```

### Cambios (3 archivos)

#### 1. `src/components/admin/attendees/NewAttendeeModal.tsx`
- Eliminar completamente el bloque que envía invitación post-creación (líneas ~58-75)
- El `onSubmit` solo crea el asistente y muestra toast con el código, sin importar el estado
- Eliminar imports de `useSendInvitations` y `useEvent` si ya no se usan

#### 2. `src/components/admin/attendees/AttendeeDetailDrawer.tsx`
- Cuando estado es `pending`: mostrar botón "Enviar credenciales" (envía email y NO cambia estado — el estado cambia cuando el asistente ingresa)
- Cuando estado es `confirmed`: ocultar botones de envío de email (ya ingresó)
- Eliminar botón "Confirmar y Enviar" — no tiene sentido en este flujo; el admin solo envía credenciales, la confirmación es automática al login

#### 3. Traducciones (`en/admin.json` y `es/admin.json`)
- `pendingHint`: ES "Sin acceso aún. Usa el detalle del asistente para enviar credenciales cuando estés listo" / EN "No access yet. Use attendee detail to send credentials when ready"
- `confirmedHint`: ES "El asistente ya ingresó al sistema. No se enviarán correos" / EN "Attendee already logged in. No emails will be sent"
- Eliminar claves de `confirmAndSend` si existen

### Resultado
- Crear asistente (individual o CSV) = nunca envía email
- Admin controla cuándo enviar credenciales desde el drawer
- Asistente ingresa con código = pasa a confirmado automáticamente
- Confirmado = botones de envío desaparecen

