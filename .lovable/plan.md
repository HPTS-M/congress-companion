

## Plan — Ajustes Mobile: Comercial, Documentos, Contactos, Mensajería, Notas, Anuncios

### Resumen ejecutivo

Cuatro problemas independientes en módulos de producción, agrupados por afinidad:

1. **Responsividad mobile** — Comercial, Documentos, Contactos, Mensajería tienen scroll horizontal por uso indebido de `gap`, `truncate` faltante y anchos fijos.
2. **Descarga de Documentos** — falla por bloqueo de pop-ups en mobile (`window.open` rechazado por Safari/Chrome iOS).
3. **Paginado de Contactos y Anuncios** — listas crecen sin límite, scroll casi infinito.
4. **Notas** — botón "Volver" no sale del editor, falta botón "Guardar" explícito (mantenemos solo auto-save), `window.print()` no genera PDF en mobile.

Cero cambios en DB, RLS o servicios de backend. Todos los cambios son frontend.

---

### 1. Responsividad mobile (4 módulos)

**Causa raíz común:** componentes diseñados con espaciado desktop (`gap-3` + padding generoso) sin `min-w-0` en flex children, lo que provoca overflow horizontal cuando el contenido excede el ancho del viewport (360px–414px).

#### 1.1 Commercial (`src/pages/attendee/Commercial.tsx` + `SponsorCard.tsx`)
- `SponsorCard`: añadir `min-w-0` al contenedor central; reducir logo a `h-12 w-12` en mobile (`sm:h-16 sm:w-16`); `flex-wrap` en badges; `text-sm` en título mobile.
- Limitar el ancho del botón "Me interesa" para que no empuje contenido.

#### 1.2 Documents (`src/pages/attendee/Documents.tsx`)
- Card actualmente: `flex items-center gap-3` sin `min-w-0` en el bloque central. Añadir `min-w-0` y `truncate` al título (ya existe `truncate` pero el padre no tiene `min-w-0` correctamente propagado).
- Reducir padding mobile (`p-3` en vez de `p-4`).

#### 1.3 Contacts (`src/pages/attendee/Contacts.tsx`)
- `AttendeeCard`: agregar `min-w-0` real en el bloque central; en mobile el botón "Conectar" se apila debajo del nombre cuando hay nombres largos. Solución: usar `flex-col sm:flex-row` solo cuando el nombre exceda; alternativa más simple: forzar `text-xs` en botones y `gap-2` mobile.
- Tabs `Participantes / Mis Contactos`: ya son `flex-1`, ok.

#### 1.4 Messaging (`DirectConversationList.tsx` + `DirectChatView.tsx`)
- `DirectConversationList`: añadir `min-w-0` en bloques centrales; los botones de invitación pendiente (`flex gap-2 mt-3`) se montan correctamente con `flex-1`, ok.
- `DirectChatView`: header del chat (no visto pero referenciado) — verificar `truncate` en nombre del contacto.
- Burbujas de mensaje ya usan `max-w-[75%]`, ok.

**Patrón aplicado:** `min-w-0` en todo flex child que contenga texto + `truncate` en el primer hijo de texto + revisar paddings mobile.

---

### 2. Descarga de Documentos

**Causa raíz:** En `src/pages/attendee/Documents.tsx` línea 56 se usa `window.open(url, '_blank')`. Safari iOS y Chrome mobile bloquean esto cuando la apertura ocurre tras un `await` (fuera del gesture handler síncrono original). Resultado: pop-up bloqueado + toast rojo de error en algunos navegadores.

**Solución (patrón `<a download>` con blob):**
```ts
const handleDownload = async (doc: EventDocument) => {
  if (downloading) return;
  setDownloading(doc.id);
  try {
    const url = await documentsService.getSignedUrl(doc.file_path);
    // Descarga vía link sintético — no requiere gesture handler síncrono
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.${doc.file_type ?? 'pdf'}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    toast({ title: 'Error', description: t('downloadError'), variant: 'destructive' });
  } finally {
    setDownloading(null);
  }
};
```

Mejoras:
- `<a download>` no es bloqueado por pop-up blocker.
- El atributo `download` sugiere descarga directa al navegador (cuando el servidor no fija `Content-Disposition`).
- `target="_blank"` como fallback para tipos que el navegador prefiere abrir inline (PDF en Chrome).

**Nota:** PPTX y XLSX descargarán siempre. PDF se abrirá en nueva pestaña en escritorio (comportamiento esperado del navegador).

---

### 3. Paginado en Contactos y Anuncios

#### 3.1 Hook reutilizable `usePaginatedList`
Ya existe `src/hooks/usePagination.ts` (cliente-side). Lo usamos.

#### 3.2 Componente nuevo `MobilePagination`
**Archivo nuevo:** `src/components/ui/mobile-pagination.tsx`

Diseño mobile-first:
- Botones grandes (`h-10`) `‹ Anterior` / `Siguiente ›`, separados por contador `Página 2 de 8`.
- En desktop (`sm:`) muestra adicionalmente número de página actual y total de items.
- Reutiliza tokens del design system (primary blue + accent teal en estado activo).

#### 3.3 Aplicación
- **Contacts.tsx:** paginar `filteredAttendees` y `acceptedContacts` (10 por página, configurable). `pendingRequests` y `sentRequests` no se paginan (típicamente <10).
- **Announcements.tsx:** paginar `announcements` (10 por página). Reset a página 1 al cambiar filtro.

Las paginaciones se aplican client-side sobre arrays ya cargados (cantidad esperada <500 items por evento — performance ok). Si la lista crece a miles, migramos a server-side con `range()` de Supabase en una iteración futura.

---

### 4. Notas — refactor del flujo

**Problemas confirmados:**
- "Volver" llama `closeEditor` que hace `await updateNote.mutateAsync(...)` antes de salir; si la mutación demora o falla, parece que el botón no responde.
- No hay botón "Guardar" — usuarios buscan confirmación visible.
- `window.print()` en mobile invoca diálogo del sistema operativo, no genera PDF descargable.
- Auto-save de 3s funciona pero no comunica al usuario.

**Decisión del usuario:** quitar auto-save, solo botón guardar.

**Refactor:**

#### 4.1 Eliminar auto-save
- Quitar `triggerSave`, `debounceRef`, `saveStatus`, refs de contenido.
- `handleContentChange` y `handleSessionChange` solo actualizan estado local.

#### 4.2 Botón "Guardar" explícito
- Botón fijo bottom: "Guardar" (primario, accent teal) + indicador "Cambios sin guardar" cuando `editorContent !== editingNote.content || editorSession !== (editingNote.session_id ?? 'none')`.
- Al guardar: `updateNote.mutateAsync(...)`, toast verde "Nota guardada", actualiza el `editingNote` local con los nuevos valores.
- Botón deshabilitado cuando no hay cambios.

#### 4.3 Botón "Volver" arreglado
- Si hay cambios sin guardar → AlertDialog "¿Descartar cambios?" con opciones `Guardar y salir` / `Descartar` / `Cancelar`.
- Si no hay cambios → salir inmediatamente (`setEditingNote(null)`).

#### 4.4 Exportación PDF real con `jsPDF`
- Instalar `jspdf` (paquete único, ~50KB gz, sin dependencias). NO usamos `html2canvas` porque las notas son texto plano y no necesitamos rasterizar HTML — generamos PDF nativo (texto seleccionable, mejor calidad).
- Función:
  ```ts
  import jsPDF from 'jspdf';
  
  const exportToPdf = (note: AttendeeNote) => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 20;
    const lineHeight = 7;
    let y = margin;
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(note.session_title ?? t('generalNote'), margin, y);
    y += 10;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(note.content ?? '', 170);
    for (const line of lines) {
      if (y > 280) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    
    pdf.save(`nota-${note.id.slice(0, 8)}.pdf`);
  };
  ```
- Funciona en mobile (Safari/Chrome): trigger directo de descarga vía blob.

#### 4.5 Botón Eliminar en editor
- Mantenemos botón eliminar (ya existe en lista). Opcional: añadir en editor para flujo completo. Por ahora respetamos el alcance pedido.

---

### 5. Anuncios — solo paginado

`Announcements.tsx` ya es responsive (cards single-column). Solo aplicamos `MobilePagination` con 10 items por página + reset al filtrar (en este módulo no hay filtros, solo orden).

---

### Archivos a modificar/crear

| Archivo | Acción |
|---|---|
| `src/components/ui/mobile-pagination.tsx` | **Nuevo** — componente paginación mobile-first |
| `src/pages/attendee/Commercial.tsx` | Padding mobile |
| `src/components/attendee/SponsorCard.tsx` | `min-w-0`, logo más pequeño en mobile |
| `src/pages/attendee/Documents.tsx` | `min-w-0` + descarga `<a download>` |
| `src/pages/attendee/Contacts.tsx` | `min-w-0` + paginado en `filteredAttendees` y `acceptedContacts` |
| `src/components/attendee/DirectConversationList.tsx` | `min-w-0` en bloques centrales |
| `src/components/attendee/DirectChatView.tsx` | `truncate` en header del chat |
| `src/pages/attendee/Announcements.tsx` | Paginado 10 items |
| `src/pages/attendee/Notes.tsx` | Quitar auto-save, botón Guardar, fix Volver, jsPDF |
| `src/locales/es/notes.json` + `en/notes.json` | Nuevas keys: `save`, `unsavedChanges`, `discardChanges`, `keepEditing`, `saveAndExit`, `discard`, `noteSaved` |
| `src/locales/es/contacts.json` + `en/contacts.json` | Keys de paginación si no existen |
| `src/locales/es/announcements.json` + `en/announcements.json` | Keys de paginación |
| `package.json` | Añadir `jspdf` (~50KB gz) |

---

### Verificación (escenarios manuales)

1. **Mobile 360px Commercial:** abrir `/ACQFH-2026/commercial` con 20 sponsors → 0 scroll horizontal, cards apiladas, logos visibles.
2. **Documentos descarga:** desde iPhone Safari, tap "descargar" PDF → archivo se descarga sin pop-up bloqueado.
3. **Contactos paginado:** lista con 30 attendees → muestra 10, botón "Siguiente" navega a página 2.
4. **Anuncios paginado:** 25 anuncios → 3 páginas, navegación funciona.
5. **Notas botón Volver:** abrir nota, modificar contenido, tap "Volver" → aparece dialog "¿Descartar?".
6. **Notas Guardar:** botón aparece habilitado solo con cambios; al guardar muestra toast.
7. **Notas Export PDF:** tap "Exportar PDF" → descarga `nota-xxxxxxxx.pdf` con título + cuerpo legible.

---

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `jspdf` añade ~50KB al bundle de Notes | Lazy import dentro de `exportToPdf` (solo se descarga cuando el usuario exporta) |
| Paginado client-side con 1000+ items genera lag | Aceptable para tamaños actuales (<500). Migrar a server-side si crece |
| `<a download>` en iOS Safari abre PDF en pestaña en vez de descargar | Comportamiento estándar del SO, no es regresión — antes ni siquiera abría |
| Quitar auto-save hace que usuario pierda nota si recarga sin guardar | Compensado con: botón siempre visible + indicador "Cambios sin guardar" + dialog de confirmación al salir |

---

### Lo que NO se toca

- DB schema, RLS, Edge Functions.
- Servicios backend (`documents.service.ts` se mantiene — solo cambia el handler).
- Bucket `event-documents` (sigue privado con signed URLs).
- Realtime de mensajería y anuncios.
- Dark mode (todos los cambios respetan tokens existentes).
- Otros módulos no mencionados (Agenda, Tickets, Polls, Check-in, Home).

### Esfuerzo

~1 hora. 12 archivos editados + 1 nuevo + 1 dependencia (`jspdf`).

