

## Plan — Mensaje de disculpa por incidente en correo de regeneración

Actualizar la plantilla del correo que reciben los asistentes cuando se regenera su código, agregando el contexto del incidente técnico, el aviso de ignorar códigos anteriores, y la invitación al stand de soporte.

---

### Propuesta de copy (español, tono institucional y empático)

**Asunto** *(sin cambios)*: `🔐 ACQFH-2026 — Nuevo código de acceso`

**Preheader** *(nuevo)*:
`Lamentamos los inconvenientes — este es tu nuevo código de acceso vigente.`

**Eyebrow** *(sin cambios)*: `🔐 Nuevo código de acceso`

**Headline** *(sin cambios)*: `Hola {nombre}, tu código fue actualizado`

**Intro** *(reescrito):*
> Lamentamos los inconvenientes causados por un **incidente técnico que ya ha sido resuelto**. Como medida de seguridad, hemos generado un **nuevo código de acceso** para ti.
>
> Por favor, **haz caso omiso de cualquier código anterior** que hayas recibido y utiliza únicamente el que acompaña este correo.

**Bloque de código** *(sin cambios)*: caja destacada con el nuevo código de 8 caracteres + label "Tu código de acceso".

**Pasos "Cómo entrar"** *(sin cambios):*
1. Toca el botón **"Entrar al evento"** que aparece más abajo.
2. Ingresa tu **código personal de 8 caracteres**.

**CTA** *(sin cambios)*: botón `Entrar al evento` → URL del evento.

**Bloque nuevo "¿Necesitas ayuda?"** *(insertado antes del footer):*
> 💬 **¿Sigues teniendo inconvenientes?**
> Acércate a nuestro **stand de soporte durante el congreso** — nuestro equipo estará acompañándote en todo momento para resolver cualquier requerimiento.

**Footer note** *(reescrito ligeramente):*
> Este código es personal e intransferible. Agradecemos tu comprensión.

**Versión texto plano (fallback Resend):** misma estructura, sin HTML, generada automáticamente por `renderEmailText`.

---

### Vista previa estructural del correo

```text
┌───────────────────────────────────────────┐
│  [Gradient header — CONGRESSAPP / ACQFH]  │
├───────────────────────────────────────────┤
│  🔐 Nuevo código de acceso                │
│                                           │
│  Hola {Nombre}, tu código fue actualizado │
│                                           │
│  Lamentamos los inconvenientes causados   │
│  por un incidente técnico que ya ha sido  │
│  resuelto. Como medida de seguridad...    │
│                                           │
│  Por favor, haz caso omiso de cualquier   │
│  código anterior y utiliza únicamente...  │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │   TU CÓDIGO DE ACCESO               │  │
│  │       X X X X - X X X X             │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Cómo entrar:                             │
│   1. Toca "Entrar al evento"              │
│   2. Ingresa tu código de 8 caracteres    │
│                                           │
│       ┌─────────────────────┐             │
│       │  Entrar al evento   │             │
│       └─────────────────────┘             │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │ 💬 ¿Sigues teniendo inconvenientes? │  │
│  │ Acércate a nuestro stand de soporte │  │
│  │ durante el congreso — nuestro equipo│  │
│  │ estará acompañándote en todo momento│  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Este código es personal e intransferible │
├───────────────────────────────────────────┤
│  ACQFH-2026 · Fechas · Sede                │
│  CONGRESSAPP · Health Plus Travels        │
└───────────────────────────────────────────┘
```

---

### Cambios técnicos (solo lo necesario)

**Archivo 1 — `supabase/functions/bulk-regenerate-access-codes/index.ts`** *(función `buildInvitationEmail`, prioritaria — la usarás para el envío masivo)*

- Reemplazar `preheader`, `intro` y `footerNote` con el copy nuevo.
- Insertar un nuevo bloque `supportBlock` (caja destacada con borde teal `#00B89F` y fondo `#F0FDFA`) entre los pasos y el footer, con el mensaje del stand de soporte.
- Concatenarlo en `body`: `codeBlock + stepList + supportBlock`.

**Archivo 2 — `supabase/functions/regenerate-access-code/index.ts`** *(función `buildRegenEmail`, regeneración individual — para consistencia)*

- Mismos cambios de copy en `preheader`, `intro`, `footerNote`.
- Misma inserción del bloque de soporte.

**Archivo 3 — `supabase/functions/_shared/email-templates.ts`** *(helper opcional)*

- Agregar una función `supportCallout(title: string, body: string): string` que renderice una caja destacada reusable. Mantiene el código limpio y permite reutilizar el bloque en futuras plantillas.

**Sin cambios en:**
- Lógica de regeneración (bcrypt, BD, Resend) — intacta.
- Frontend / modales admin — los textos del UI no cambian.
- Asunto del correo — se mantiene.
- i18n — el correo es solo en español por diseño actual del proyecto.

---

### Validación post-cambio

1. **Deploy** de las dos edge functions modificadas.
2. **Prueba dirigida** con 1 asistente real (TEST1234 o similar) usando el modal "Regenerar acceso" individual → revisar correo recibido.
3. **Confirmar visualmente** en cliente Gmail/Outlook web/iOS Mail que:
   - El bloque de disculpa aparece arriba con el tono correcto.
   - La caja del código resalta.
   - El bloque "¿Necesitas ayuda? Stand de soporte" aparece destacado en teal.
4. **Solo después de validar el correo individual**, ejecutar la regeneración masiva desde el modal "Regenerar códigos en lote".

---

### Decisiones que necesito confirmar antes de implementar

1. **Tono del incidente:** ¿prefieres mencionarlo explícitamente como "incidente técnico" (transparente) o suavizarlo como "actualización de seguridad" (más neutro)? Mi propuesta usa la primera.
2. **Ubicación del stand:** ¿quieres que el bloque diga genéricamente "nuestro stand de soporte" o agrego ubicación concreta (ej. "stand de registro, lobby principal")? Si me das la ubicación, la incluyo.
3. **Firma:** ¿agregamos al final el nombre del organizador (ej. "El equipo de ACQFH-2026") o se mantiene el footer estándar de CONGRESSAPP?

Confirma estos 3 puntos y procedo a implementar los cambios en las 3 funciones, hacer deploy, y dejarte listo para enviar la prueba individual antes del envío masivo.

