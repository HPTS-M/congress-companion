

## Plan: Limpiar iconos duplicados del header en escritorio

### Diagnóstico

Hoy el `AppHeader` tiene 4 iconos a la derecha:

| Icono | Acción | ¿Dónde más existe? | ¿Duplicado? |
|---|---|---|---|
| 🌐 Idioma | Cambia es ↔ en | Ningún otro lado | ❌ No duplicado |
| 🔔 Campana | Va a `/announcements` | Sidebar (Anuncios) y menú hamburguesa | ✅ Duplicado |
| 💬 Mensajes | Va a `/messaging` | Sidebar (Mensajes) y menú hamburguesa | ✅ Duplicado |
| 👤 Perfil | Va a `/profile` | No está en sidebar/hamburguesa | ❌ No duplicado |

Los iconos de **campana 🔔** y **mensajes 💬** son atajos a páginas que ya están listadas en el sidebar lateral en escritorio (sección "Más"). En móvil, la barra inferior (BottomNav) y el menú hamburguesa también los exponen.

El **idioma** y el **perfil** NO existen en el sidebar ni en el hamburger — son únicos del header. Eliminarlos rompería accesos sin alternativa.

### Decisión

Eliminar **solo en escritorio (≥ md)** los botones duplicados (campana y mensajes). En móvil se conservan, porque ahí el sidebar está oculto y los atajos del header son la forma rápida de llegar a esas pantallas (el hamburger requiere un tap extra y la barra inferior no incluye Anuncios ni Mensajes).

| Icono | Móvil (< md) | Escritorio (≥ md) |
|---|---|---|
| 🌐 Idioma | Visible | Visible |
| 🔔 Campana | Visible | **Oculto** |
| 💬 Mensajes | Visible | **Oculto** |
| 👤 Perfil | Visible | Visible |

Las indicaciones de no leídos (badge rojo y dot offline) se mueven al item correspondiente del sidebar en escritorio, para que el usuario no pierda la señal visual de mensajes/anuncios pendientes.

### Cambios concretos

**1. `src/components/layout/AppHeader.tsx`**
- Agregar clase `hidden md:hidden` (efectivamente `md:hidden`) a los `<Button>` de campana y mensajes para ocultarlos desde el breakpoint `md`.
- Conservar toda la lógica de `markAsSeen`, badges, polling, dot offline — no se elimina nada del comportamiento, solo se oculta el control visual en escritorio.
- No tocar idioma, perfil, logo central ni hamburguesa.

**2. `src/components/layout/AttendeeSidebar.tsx`** (mejora ligada — escritorio)
- Agregar badge numérico al item "Anuncios" usando `useUnreadAnnouncements(event.id)` (mismo hook que el header).
- Agregar badge numérico al item "Mensajes" usando `useUnreadMessages(event.id)`.
- Agregar el dot ámbar de offline al item "Mensajes" usando `useOnlineStatus()`.
- El click en el item de "Anuncios" o "Mensajes" del sidebar también invocará `markAsSeen()` del hook correspondiente (paridad con el header).
- Los badges se muestran solo cuando `!collapsed` (con la sidebar expandida). Cuando está colapsada en modo `icon`, mostrar un pequeño punto rojo sobre el icono si `count > 0`.

**3. Sin cambios en**
- `BottomNav` (no incluye Anuncios ni Mensajes; sigue intacta).
- `HamburgerMenu` (sigue ofreciendo los accesos en móvil).
- `useUnreadAnnouncements`, `useUnreadMessages`, realtime, polling — la lógica de notificaciones no se toca.
- i18n — se reusa `nav.announcements` y `nav.messaging` ya existentes.

### Resultado esperado

| Pantalla | Antes | Después |
|---|---|---|
| Escritorio (≥ 768 px) | Header con 4 iconos + sidebar con 13 items repetidos | Header con 2 iconos (idioma + perfil), badges/notificaciones se ven en el sidebar |
| Móvil (< 768 px) | Sin cambios | Sin cambios — campana, mensajes, idioma y perfil siguen en el header |
| Notificaciones nuevas en escritorio | Badge rojo en campana del header | Badge rojo en item "Anuncios" del sidebar (y en "Mensajes" para chats) |
| Click en item del sidebar | No marca como visto | Marca como visto + navega (paridad con el header de móvil) |

### Verificación post-deploy

1. Login asistente en `ACQFH-2026` desde escritorio (viewport ≥ 1024 px) → confirmar que en el header solo se ven 🌐 idioma + 👤 perfil.
2. Admin envía un anuncio → confirmar que el badge rojo aparece en el item "Anuncios" del sidebar (no en el header).
3. Otro asistente envía un mensaje directo → confirmar badge en "Mensajes" del sidebar; clickear y confirmar que se marca como leído.
4. Apagar red → confirmar que el dot ámbar offline aparece sobre "Mensajes" en el sidebar.
5. Cambiar a móvil (viewport 375 px) → confirmar que campana, mensajes, idioma y perfil siguen visibles en el header.
6. Probar sidebar colapsada (modo `icon`) en escritorio → confirmar que el dot rojo de no leídos sigue visible sobre el icono.

