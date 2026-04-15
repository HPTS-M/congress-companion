

## Plan: Perfil editable + nombre en header

### 1. MyProfile — Campos editables de especialidad e institución

**Archivo:** `src/pages/attendee/MyProfile.tsx`

- **Correo y Código de credencial**: Se mantienen como campos de solo lectura, precargados desde `attendee.email` y `attendee.credential_code`.
- **Especialidad e Institución**: Cambiar de solo lectura a campos `<Input>` editables, precargados con los valores actuales (o vacíos si no tienen datos).
- **Botón Guardar**: Aparece solo cuando el usuario modifica especialidad o institución. Al hacer clic, ejecuta `UPDATE` en la tabla `attendees` con los nuevos valores.
- Se usa `useMutation` de TanStack Query para el guardado, con toast de confirmación.

### 2. AppHeader — Nombre y avatar del asistente en esquina superior derecha

**Archivo:** `src/components/layout/AppHeader.tsx`

- Reemplazar el icono genérico `<User>` por el avatar con inicial del asistente (círculo con la primera letra del nombre) + nombre truncado visible en desktop (`hidden md:block`).
- Al hacer clic, sigue navegando a `/{eventSlug}/profile`.

### 3. i18n — Nuevas claves

**Archivos:** `src/locales/es/common.json`, `src/locales/en/common.json`

Agregar dentro de `profile`:
- `specialtyPlaceholder`: "Ingresa tu especialidad" / "Enter your specialty"
- `institutionPlaceholder`: "Ingresa tu institución" / "Enter your institution"  
- `save`: "Guardar" / "Save"
- `saved`: "Perfil actualizado" / "Profile updated"

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/attendee/MyProfile.tsx` | Inputs editables para especialidad/institución + botón guardar |
| `src/components/layout/AppHeader.tsx` | Inicial + nombre del asistente en esquina derecha (desktop) |
| `src/locales/es/common.json` | Nuevas claves de perfil |
| `src/locales/en/common.json` | Nuevas claves de perfil |

### Orden de implementación
1. i18n (claves nuevas)
2. MyProfile (campos editables + guardar)
3. AppHeader (avatar + nombre)

