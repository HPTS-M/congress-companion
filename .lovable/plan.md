

## Plan: Ocultar botón de mensajes en todo el header (desktop y móvil)

### Cambio

**`src/components/layout/AppHeader.tsx`**:

El botón de mensajes (MessageCircle) actualmente tiene la clase `md:hidden`, que lo oculta solo en desktop. El usuario quiere que el botón no aparezca **ni en móvil ni en desktop** (ya que el acceso a mensajería se hará exclusivamente desde la bottom nav móvil).

### Detalles técnicos

- Reemplazar `md:hidden` por `hidden` en el contenedor del botón de mensajería (alrededor de la línea 111).
- Esto oculta completamente el ícono de mensajes del header en ambos breakpoints.
- Mantener todo el resto del header intacto: anuncios, idioma, perfil, y las badges en el menú hamburguesa.
- La mensajería sigue estando accesible desde la bottom nav en móvil (como se configuró en cambios anteriores).

### Verificación

1. En móvil (360 px): el header muestra solo idioma, anuncios y perfil — sin ícono de mensajes.
2. En desktop (≥768 px): el header muestra lo mismo — sin ícono de mensajes.
3. La bottom nav en móvil sigue mostrando el tab de "Mensajería" con su badge de no-leídos.
4. Sin errores de TypeScript ni regresiones visuales.

