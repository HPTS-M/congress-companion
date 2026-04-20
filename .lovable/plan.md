

## Ajustes módulos Documentos y Patrocinadores

### Diagnóstico raíz (importante para entender los fixes)

**🔴 Bug crítico en RLS de `storage.objects` para el bucket `event-sponsors`** (causa principal de varios síntomas):

La policy SELECT actual `Authenticated read own event sponsor assets` tiene tres cláusulas y **dos están rotas**:
```sql
(storage.foldername(name))[1] IN (SELECT get_my_event_ids())  -- solo sirve para attendees
OR EXISTS (SELECT 1 FROM events e WHERE (e.id::text = (storage.foldername(e.name))[1]) ...)
                                                            -- ❌ usa e.name en vez de objects.name
OR EXISTS (SELECT 1 FROM events e WHERE (e.id::text = (storage.foldername(e.name))[1]) ...)
                                                            -- ❌ mismo error
```
Resultado: cuando un **admin** (sin fila en `attendees`) intenta leer/listar un PDF de sponsor:
- `getSignedUrl()` falla → preview de materiales devuelve "No se pudo cargar".
- `uploadFile()` → el `.list()` post-upload no encuentra el objeto (RLS bloquea SELECT) → lanza `upload_verification_failed` → **toast de error al crear/editar sponsor con PDF**, aunque el archivo SÍ se subió. Por eso aparece error pero el sponsor a veces queda guardado a medias.

**🔴 Policy análoga para `event-documents`**: solo permite SELECT a authenticated cuyo `event_id` esté en `attendees` del usuario. Los **admins no tienen fila en attendees** → no pueden leer sus propios documentos → el preview en `/admin/documents` falla con "No se pudo cargar la previsualización".

**🟡 Validación WhatsApp**: el regex `^\+?[1-9]\d{7,14}$` está bien, pero el `<Input>` no restringe la entrada en tiempo real (acepta letras y luego rechaza al validar). UX deficiente.

**🟡 Refresco de rejilla sponsors**: `useAdminSponsors` usa `invalidateQueries` (refetch async). En conexiones lentas, el usuario no ve el sponsor recién creado al cerrar el modal. Falta botón de refresh manual y actualización optimista.

**🟡 Tabs del drawer detalle**: `<TabsList grid-cols-3>` con labels "Información de contacto" / "Estadísticas" / "Leads (N)" → labels demasiado largos para anchos < 540px (el viewport actual del usuario es 548px y ya se ve cortado).

**🟡 Material preview en drawer detalle**: ya existe (`SponsorMaterialPreviewModal`) pero comparte el mismo bug de RLS, así que muestra "no se pudo cargar".

---

### Cambios a realizar

#### 1. Migración: corregir RLS de storage para admins

Reemplazar las dos policies SELECT defectuosas:

```sql
-- event-sponsors: agregar acceso completo para admins/superusers
DROP POLICY IF EXISTS "Authenticated read own event sponsor assets" ON storage.objects;

CREATE POLICY "Read event sponsor assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-sponsors'
  AND (
    has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR ((storage.foldername(name))[1])::uuid IN (SELECT get_my_event_ids())
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id::text = (storage.foldername(storage.objects.name))[1]
        AND is_event_staff(auth.uid(), e.id)
    )
  )
);

-- event-documents: agregar acceso para admins
DROP POLICY IF EXISTS "Authenticated read own event files" ON storage.objects;

CREATE POLICY "Read event documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-documents'
  AND (
    has_role(auth.uid(), 'superuser'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR ((storage.foldername(name))[1])::uuid IN (SELECT get_my_event_ids())
  )
);
```

Esto resuelve **3 bugs a la vez**: preview documentos, preview materiales sponsor, y el falso `upload_verification_failed` al subir PDF.

#### 2. `src/components/admin/sponsors/SponsorModal.tsx` — Validación WhatsApp en tiempo real

- Agregar handler `handleWhatsappChange` que filtre al teclear: solo permitir un único `+` al inicio, dígitos, y máximo 16 chars (`+` + 15).
- Agregar `inputMode="tel"` y `maxLength={16}` al `<Input>` de WhatsApp.
- Mantener regex actual para validación final.

```tsx
const handleWhatsappChange = (raw: string) => {
  let cleaned = raw.replace(/[^\d+]/g, '');
  // Solo un + permitido y al inicio
  if (cleaned.indexOf('+') > 0) cleaned = cleaned.replace(/\+/g, '');
  if ((cleaned.match(/\+/g) ?? []).length > 1) cleaned = '+' + cleaned.replace(/\+/g, '');
  setWhatsapp(cleaned.slice(0, 16));
};
```

Actualizar placeholder a `+573001234567` y agregar texto de ayuda: "Formato internacional: + seguido de 8-15 dígitos".

#### 3. `useAdminSponsors.ts` — Actualización optimista + invalidate inmediato

- En `createMutation.onMutate`: insertar optimistamente un sponsor placeholder en la cache con `id: 'optimistic-…'`.
- En `onSuccess`: reemplazar el placeholder con la fila real Y disparar `qc.invalidateQueries`.
- En `onError`: revertir.

Esto hace que la rejilla muestre el nuevo sponsor **inmediatamente** al cerrar el modal, sin esperar al refetch.

#### 4. `src/pages/admin/Sponsors.tsx` — Botón "Actualizar"

Agregar botón de refresh en la barra de acciones (igual que en `Documents.tsx`):

```tsx
const isFetching = useIsFetching({ queryKey: ['admin-sponsors', event?.id] });

<Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['admin-sponsors', event?.id] })} disabled={isFetching > 0}>
  <RefreshCw className={cn('h-4 w-4', isFetching > 0 && 'animate-spin')} />
</Button>
```

#### 5. `SponsorDetailDrawer.tsx` — Tabs responsivas mobile-first

Reemplazar labels textuales por **icono + label corto**, y permitir wrap/scroll en mobile:

```tsx
<TabsList className="grid w-full grid-cols-3 h-auto">
  <TabsTrigger value="info" className="flex flex-col gap-1 py-2 text-xs sm:flex-row sm:text-sm">
    <Info className="h-4 w-4" />
    <span className="truncate">{t('sponsors.tabContact')}</span>
  </TabsTrigger>
  <TabsTrigger value="stats" className="...">
    <BarChart3 className="h-4 w-4" />
    <span className="truncate">{t('sponsors.tabStats')}</span>
  </TabsTrigger>
  <TabsTrigger value="leads" className="...">
    <Heart className="h-4 w-4" />
    <span className="truncate">Leads {leads.length > 0 && `(${leads.length})`}</span>
  </TabsTrigger>
</TabsList>
```

Nuevas claves i18n: `sponsors.tabContact` ("Contacto" / "Contact"), `sponsors.tabStats` ("Estadísticas" / "Stats").

#### 6. `SponsorMaterialPreviewModal.tsx` — Robustez del preview

- Mantener iframe para PDF + agregar fallback `<object>` con `onError` (igual patrón que `DocumentPreviewModal`).
- Mostrar estado `renderError` con botón "Descargar" cuando el iframe falla (algunos navegadores móviles no embeben PDF).
- Aplicar el mismo patrón de mobile-first usado en `DocumentPreviewModal` (`w-[calc(100%-1rem)]`, `p-4 sm:p-6`).

#### 7. `admin-sponsors.service.ts` — Hacer la verificación post-upload tolerante

Después del fix de RLS la verificación ya funcionará, pero adicionalmente:

- Si `list()` devuelve error o array vacío **NO hacer cleanup** automático (el archivo SÍ se subió). En su lugar, devolver `{path, size: file.size}` con `size` tomado del `File` original como fallback. Loguear advertencia pero no romper el flujo.
- Esto evita que un fallo transitorio de RLS rompa la creación del sponsor.

```ts
// Verificación best-effort, no destructiva
try {
  const { data: list } = await supabase.storage.from(BUCKET).list(eventId, { search: filename });
  const uploaded = list?.find(o => o.name === filename);
  const verifiedSize = (uploaded?.metadata as any)?.size;
  if (uploaded && verifiedSize > 0) return { path, size: verifiedSize };
} catch {/* ignore, fall through */}
return { path, size: file.size };
```

#### 8. i18n — nuevas claves en `admin.json` (es/en)

Bajo `sponsors`:
- `tabContact`: "Contacto" / "Contact"
- `tabStats`: "Estadísticas" / "Stats"
- `refresh`: "Actualizar" / "Refresh"
- `validation.whatsappHelp`: "Formato internacional: + seguido de 8-15 dígitos" / "International format: + followed by 8-15 digits"

---

### Resultado esperado

| Item | Antes | Después |
|---|---|---|
| Preview documento admin | "No se pudo cargar" | Muestra PDF/imagen correctamente |
| Preview material sponsor | "No se pudo cargar" | Muestra PDF con fallback descarga |
| WhatsApp input | Acepta letras, símbolos, >15 chars | Solo `+` y dígitos, máx 16 chars |
| Crear sponsor con PDF | Toast de error aunque se guarda | Crea sin error y rejilla refresca al instante |
| Editar sponsor con PDF | Mismo error | Funciona limpiamente |
| Rejilla sponsors | Tarda en mostrar el nuevo | Aparece inmediato (optimista) + botón refresh |
| Tabs drawer detalle | Labels cortados | Icono + label, responsive 360-1024px |

### Consideraciones

- El fix de RLS es **el cambio más importante** y por sí solo resuelve 3 bugs reportados.
- La verificación post-upload pasa de "destructiva" a "best-effort" para evitar falsos negativos cuando RLS limite SELECT. La validación previa al seleccionar el archivo (MIME/tamaño) sigue siendo la primera línea de defensa.
- Backend-First: migración RLS primero, luego servicios, luego UI.
- Los componentes de tabs usarán shadcn `<Tabs>` extendido, sin tocar `/components/ui/`.

