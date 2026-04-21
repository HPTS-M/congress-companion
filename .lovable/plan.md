

## Cambio rápido: Eliminar paso de escaneo QR del correo de invitación

### Descripción
Eliminar el tercer paso ("También puedes escanear el QR de tu credencial desde la app") de la lista de instrucciones "Cómo entrar" en el correo de invitación a asistentes.

### Archivo a modificar
- `supabase/functions/send-invitation-email/index.ts` — líneas 100-104

### Cambio específico
```typescript
// ANTES (3 pasos):
const steps = [
  'Toca el botón <strong>"Entrar al evento"</strong> que aparece más abajo.',
  'Ingresa tu <strong>código personal de 8 caracteres</strong>.',
  'También puedes escanear el QR de tu credencial desde la app.',  // ← ELIMINAR
];

// DESPUÉS (2 pasos):
const steps = [
  'Toca el botón <strong>"Entrar al evento"</strong> que aparece más abajo.',
  'Ingresa tu <strong>código personal de 8 caracteres</strong>.',
];
```

### Re-despliegue necesario
Las 4 funciones Edge deben re-desplegarse para aplicar el cambio:
- `send-invitation-email`
- `regenerate-access-code`
- `create-staff-user`
- `create-provider-user`

### Impacto
- Los correos de invitación nuevos mostrarán solo 2 pasos para ingresar.
- Los correos de regeneración de código no usan `stepList`, no se ven afectados.
- Sin impacto en Staff ni Proveedores (sus flujos son diferentes).

