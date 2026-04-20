

## Aviso de privacidad antes de enviar interés a patrocinador

### Objetivo

Antes de registrar el "Me interesa" en un patrocinador, mostrar un modal de confirmación que informe al asistente **qué datos suyos serán compartidos** con ese patrocinador, y requerir aceptación explícita.

### Contexto técnico

El flujo actual (`src/components/attendee/SponsorLeadButton.tsx`) ejecuta `sponsorLeadsService.create(...)` directamente al hacer click. El servicio inserta en `sponsor_leads`, y el patrocinador (vía panel admin) ve: `full_name`, `email`, `specialty`, `institution`, `phone` del asistente (definido en `SponsorLeadWithAttendee`).

El usuario nunca es informado explícitamente de esta compartición de datos personales — riesgo de cumplimiento (GDPR / Habeas Data Colombia) y de UX.

### Cambios a realizar

#### 1. Nuevo componente `SponsorLeadConsentDialog.tsx`

Ubicación: `src/components/attendee/SponsorLeadConsentDialog.tsx`

- Basado en `AlertDialog` de shadcn (ya usado en el proyecto, p. ej. `SponsorModal.tsx`).
- Props: `open`, `onClose`, `onConfirm`, `sponsorName`, `loading`.
- Contenido:
  - **Título**: "Compartir tus datos con {sponsorName}"
  - **Descripción**: Texto claro que explique:
    - Qué datos se compartirán: nombre, email, especialidad, institución y teléfono (si está disponible en el perfil).
    - Para qué: el patrocinador podrá contactarte con información comercial relacionada al evento.
    - Que la acción es voluntaria y queda registrada.
  - **Lista visual** de los campos que se compartirán (con iconos: `User`, `Mail`, `Briefcase`, `Building2`, `Phone`).
  - **Nota de privacidad**: "Solo los patrocinadores que apruebes verán tu información. Puedes contactar al organizador para revocar el consentimiento."
- Botones:
  - Cancelar (secundario)
  - "Sí, compartir mis datos" (primario, color `#1A56A0`)

#### 2. Modificar `SponsorLeadButton.tsx`

- Agregar estado `showConsent: boolean`.
- Al hacer click en el botón → `setShowConsent(true)` (NO llamar al servicio aún).
- Renderizar `<SponsorLeadConsentDialog>` controlado por ese estado.
- `onConfirm` del modal → ejecuta `sponsorLeadsService.create(...)` (la lógica actual del `handleClick` se mueve aquí).
- El estado `loading` se pasa al modal para deshabilitar el botón de confirmar mientras se crea el lead.
- Pasar el `sponsorName` como prop nueva al `SponsorLeadButton` (requerido), provisto desde `Commercial.tsx` (`SponsorCard`) y `SponsorDetail.tsx`.

#### 3. Actualizar i18n en `commercial.json` (es y en)

Agregar bajo la clave existente `lead`:

```json
"lead": {
  ...
  "consent": {
    "title": "Compartir tus datos con {{sponsor}}",
    "intro": "Al confirmar, los siguientes datos de tu perfil serán compartidos con este patrocinador para que pueda contactarte:",
    "fields": {
      "name": "Nombre completo",
      "email": "Correo electrónico",
      "specialty": "Especialidad",
      "institution": "Institución",
      "phone": "Teléfono (si está registrado)"
    },
    "purpose": "El patrocinador podrá enviarte información comercial relacionada al evento.",
    "privacy": "Solo los patrocinadores que apruebes recibirán tu información. Para revocar, contacta al organizador del evento.",
    "confirm": "Sí, compartir mis datos",
    "cancel": "Cancelar"
  }
}
```

Versión inglesa equivalente.

#### 4. Pasar `sponsorName` al botón

- `src/pages/attendee/Commercial.tsx` — `SponsorCard`: `<SponsorLeadButton sponsorId={sponsor.id} eventId={eventId} sponsorName={sponsor.name} ... />`
- `src/pages/attendee/SponsorDetail.tsx` — donde se renderice `SponsorLeadButton`, pasar `sponsorName={sponsor.name}`.

### Resultado esperado

1. Usuario hace tap en "Me interesa" en cualquier card o detalle de patrocinador.
2. Aparece modal con lista clara de datos a compartir + propósito + nota de privacidad.
3. Si cancela → no se inserta nada, vuelve al estado anterior.
4. Si confirma → se inserta en `sponsor_leads`, modal se cierra, botón pasa a estado "Interés registrado" (igual que hoy).
5. La copia respeta i18n (es/en) y el branding `#1A56A0`.

### Consideraciones

- No se altera el esquema de BD ni RLS — el cambio es 100% UI/UX y consentimiento informado.
- No se modifica el comportamiento idempotente: si ya existe el lead, el botón sigue mostrando "Interés registrado" y el modal nunca se abre.
- Cumplimiento: queda evidencia explícita del consentimiento (timestamp en `sponsor_leads.created_at` ya existente).

