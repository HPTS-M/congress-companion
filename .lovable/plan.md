

## Diagnóstico

El toggle "Códigos externos" en `EventSettingsCard.tsx` (líneas 94-114) está **completamente funcional**:
- ✅ Lee correctamente el estado desde `event.settings.external_credentials_enabled`
- ✅ Persiste en BD vía `updateSetting.mutate({ key: 'external_credentials_enabled', value })`
- ✅ El `ImportCsvModal` ya consume este flag para activar/desactivar la columna de código externo

**Lo que falta:** las claves de traducción `settings.externalCredentials` y `settings.externalCredentialsDescription` no están definidas en los locales, por eso i18next muestra la clave literal como fallback.

## Plan

### Paso único · Agregar traducciones faltantes

**`src/locales/es/admin.json`** — sección `settings`:
- `externalCredentials`: "Códigos de credencial externos"
- `externalCredentialsDescription`: "Permite cargar códigos de credencial propios desde el CSV (ej. cédula profesional, ID corporativo). Identifica de forma única a cada asistente y nunca puede repetirse."

**`src/locales/en/admin.json`** — sección `settings`:
- `externalCredentials`: "External credential codes"
- `externalCredentialsDescription`: "Allows uploading custom credential codes from CSV (e.g., professional ID, corporate ID). Uniquely identifies each attendee and can never be duplicated."

### Verificación
1. Recargar `/admin/event-config` → el toggle debe mostrar "Códigos de credencial externos" + descripción legible
2. Activarlo → consultar BD: `events.settings.external_credentials_enabled = true`
3. Abrir el `ImportCsvModal` → la columna "Código credencial" debe aparecer como campo procesable

Una vez activado, podemos pasar al siguiente paso (recuperar los códigos de los asistentes ya cargados con el toggle apagado).

