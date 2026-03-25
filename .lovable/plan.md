

## Fix: URL del email apunta al dominio incorrecto

### Problema
La Edge Function `send-invitation-email` tiene en línea 160:
```
const appUrl = Deno.env.get('APP_URL') || 'https://congress-connect-app.lovable.app';
```
Y en línea 62 el botón usa `appUrl` sin incluir el event code, así que el link lleva al landing genérico en el dominio equivocado.

### Cambios (1 archivo + 1 secret)

#### 1. Agregar secret `APP_URL` en Supabase Edge Functions
- Valor: `https://congress-companion.vercel.app`
- Esto se puede hacer ahora mismo, no es algo para el futuro

#### 2. `supabase/functions/send-invitation-email/index.ts`
- **Línea 160**: Cambiar fallback a `'https://congress-companion.vercel.app'`
- **Línea 62**: Cambiar `href="${appUrl}"` a `href="${appUrl}/${eventCode}"` para que el botón lleve directamente a la página del evento
- Actualizar la firma de `buildEmailHtml` — el parámetro `appUrl` ya se pasa, solo hay que construir la URL completa con el event code dentro de la función

### Resultado
- El botón "Open Event App" en el email llevará a `https://congress-companion.vercel.app/ACQFH-2026`
- Si en el futuro cambias de dominio, solo actualizas el secret `APP_URL` sin redesplegar

