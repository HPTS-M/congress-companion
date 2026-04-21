

# Auditoría UX y plan de optimización de plantillas de correo

## Diagnóstico actual

El proyecto tiene **4 plantillas HTML** independientes, cada una construida a mano dentro de su Edge Function. Hay inconsistencias claras de marca, idioma, accesibilidad y experiencia.

### Inventario

| # | Función | Destinatario | Idioma | Marca CONGRÉSSAPP | Soporte Outlook |
|---|---|---|---|---|---|
| 1 | `send-invitation-email` | Asistente (credenciales) | **Inglés** ❌ | Sin nombre app/footer | div-based (frágil) |
| 2 | `regenerate-access-code` | Asistente (código nuevo) | **Inglés** ❌ | Sin nombre app/footer | div-based (frágil) |
| 3 | `create-staff-user` | Staff (invitación) | Español ✅ | Completo + footer | table-based ✅ |
| 4 | `create-provider-user` | Proveedor (invitación) | Español ✅ | Parcial (sin footer) | div-based (frágil) |

### Problemas detectados

**Críticos**
1. **Idioma incorrecto en correos al asistente** (los más usados, miles de envíos). Están en inglés mientras el congreso es en español. Texto como "Your Event Credentials", "Open Event App", "Hello".
2. **Sin nombre del evento en el remitente perceptible**: el `subject` no incluye el nombre del evento → en bandeja se ve genérico, baja apertura.
3. **Falta de instrucciones de qué hacer** después de recibir el código: no explica que debe entrar al link, ingresar el código de 8 caracteres, ni que también puede escanear QR.
4. **El "Event Code" se muestra como dato suelto** sin contexto — confunde al asistente entre "código del evento" (URL) y "código de acceso" (login).

**De marca**
5. Inconsistencia visual entre las 4 plantillas (gradientes, tipografías, footers diferentes, emoji en unas y en otras no).
6. Dos plantillas no incluyen el footer "© CONGRÉSSAPP — Health Plus Travels".
7. Sin logo/imagen de marca — solo texto en el header.

**De UX / contenido**
8. El asunto de invitación al asistente es genérico — sin urgencia ni contexto.
9. No hay vista previa (preheader text) — en bandeja se ve la primera línea del HTML, no un resumen útil.
10. No menciona fecha del evento ni sede — datos clave para que el asistente reconozca el correo.
11. El correo de **regeneración de código** no aclara *por qué* se regeneró (admin lo hizo, perdiste el anterior, etc.).
12. El correo de **proveedor** menciona "este enlace expira en 24 horas" pero el de staff no — inconsistente.
13. Sin enlace de "ayuda" o contacto del organizador si algo falla.
14. Sin versión de texto plano (`text` en Resend) — los clientes que no renderizan HTML quedan sin nada legible.

**Accesibilidad / técnica**
15. Falta `lang="es"` en `<html>` — afecta lectores de pantalla.
16. Sin `alt` en futuros logos.
17. Layout basado en `div` en 3 de 4 plantillas — Outlook 2016/2019 lo rompe (debería ser `<table>` como hace `create-staff-user`).
18. Estilos repetidos en cada plantilla → mantenimiento costoso.

---

## Propuesta

### Fase 1 — Helper compartido de plantillas (refactor mínimo, alto impacto)

Crear `supabase/functions/_shared/email-templates.ts` con:

- **Función base `renderEmail({ preheader, headline, intro, body, ctaLabel, ctaUrl, footerNote, eventName, eventDates? })`** que devuelve HTML table-based compatible con Outlook + dark mode + preheader oculto.
- **Componentes reutilizables**: `codeBlock(code, label)`, `infoCard(label, value)`, `divider()`.
- **Branding centralizado**: gradiente, colores `#1A56O`/`#00B89F`, footer con copyright + año, tipografía Inter con fallback.
- **Versión texto plano automática** generada desde los mismos parámetros.

### Fase 2 — Reescribir las 4 plantillas

Cada Edge Function pasa a llamar a `renderEmail(...)` con su contenido específico.

**1. Invitación a asistente (`send-invitation-email`)** — *en español*
- Asunto: `🎫 {{eventName}} — Tu acceso al congreso`
- Preheader: `Tu código personal para entrar a la app del evento — {{eventDates}}`
- Headline: `Hola {{name}}, ¡bienvenido/a a {{eventName}}!`
- Intro: 1 línea + fecha y sede del evento.
- Bloque de código grande (sin cambios visuales, ya está bien).
- Sección "Cómo entrar" con 3 pasos numerados:
  1. Toca el botón "Entrar al evento".
  2. Ingresa tu código de 8 caracteres.
  3. (O escanea el QR desde la app si lo prefieres.)
- CTA principal: "Entrar al evento".
- Footer: "Si no esperabas este correo, contacta al organizador." + copyright.

**2. Regeneración de código (`regenerate-access-code`)** — *en español*
- Asunto: `🔐 {{eventName}} — Nuevo código de acceso`
- Preheader: `Tu código anterior ya no es válido. Aquí está el nuevo.`
- Aclara: "El organizador ha regenerado tu código. El anterior ya no funciona."
- Mismo bloque de código + CTA.

**3. Staff (`create-staff-user`)** — *ya está bien, solo unificar al helper*
- Mantener contenido actual, migrar al renderer compartido para consistencia visual.

**4. Proveedor (`create-provider-user`)** — *unificar marca y footer*
- Migrar al helper, agregar footer estándar, alinear estilo de botón con las otras 3.

### Fase 3 — i18n del correo (futuro, opcional)

Detectar idioma del evento (campo `events.settings.email_language` o el i18n del admin que envía) para soportar inglés cuando aplique. **No incluido en este plan** — requiere decisión de producto.

---

## Detalles técnicos

**Archivos a crear**
- `supabase/functions/_shared/email-templates.ts` — renderer compartido.

**Archivos a modificar**
- `supabase/functions/send-invitation-email/index.ts` — reemplazar `buildEmailHtml` + agregar fecha/sede al payload (`event.start_date`, `event.end_date`, `event.venue_name`).
- `supabase/functions/regenerate-access-code/index.ts` — reemplazar `buildEmailHtml`.
- `supabase/functions/create-staff-user/index.ts` — reemplazar `buildEmailHtml`.
- `supabase/functions/create-provider-user/index.ts` — reemplazar `sendInviteEmail` HTML inline.

**Cambios en Resend**
- Agregar `text:` (versión plana) a los 4 envíos.
- Asegurar `from:` consistente: `Health Plus Travels Events <noreply@healtplustravels.app>` (ya configurado).

**Sin cambios en**
- Base de datos / RLS / migraciones.
- UI del admin.
- Lógica de bcrypt, retries, logging.

**Riesgo**
- Bajo. Es refactor de presentación. La lógica de envío, reintentos, logging y persistencia del hash queda intacta. El asunto cambia → posibles filtros de spam personalizados de algún cliente podrían reaccionar; mitigación: mantener nombre del remitente y dominio verificado.

**Esfuerzo estimado**
- ~1.5–2 horas: helper compartido + 4 plantillas + testing manual con Resend en una cuenta de prueba.

---

## Fuera de alcance
- Soporte multi-idioma dinámico (inglés/español según asistente).
- Logo gráfico embebido (requiere subirlo a Storage y manejar `cid:` o URL pública).
- Correos transaccionales nuevos (recordatorios de sesión, confirmación de check-in, etc.) — esto es solo **optimización de los 4 existentes**.

