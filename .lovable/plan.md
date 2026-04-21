

## Plan: Arreglar visibilidad de los checks ✓ y ✓✓

### Diagnóstico

Confirmé en la base de datos que el sistema **funciona correctamente**:

- La columna `delivered_at` existe ✓
- La RPC `mark_messages_delivered` está desplegada ✓
- Realtime `UPDATE` activo en `chat_messages` ✓
- Hay mensajes con `delivered_at` poblado correctamente ✓

**El bug es puramente visual**: los iconos `Check`/`CheckCheck` se renderizan con `text-white/70`, pero **NO están dentro de la burbuja azul** del mensaje — están en la línea inferior con la hora, sobre el fondo oscuro del chat. Por eso son invisibles.

Adicionalmente, en tu caso particular como David Sanguino, los mensajes que enviaste a "PRUEBA ENVIO" están con `delivered_at = NULL` porque esa cuenta no ha vuelto a abrir el chat — comportamiento correcto, solo hace falta que la otra persona entre a la conversación.

### Cambio

Un único archivo: `src/components/attendee/DirectChatView.tsx` (líneas 388-398).

Reemplazar `text-white/70` por una clase que respete el color del texto contenedor (la hora ya está en `text-muted-foreground`, perfectamente visible en light/dark):

```tsx
{isOwn && !pendingInfo && (
  msg.delivered_at ? (
    <CheckCheck
      className="h-3.5 w-3.5 text-[hsl(170,100%,36%)]"  // teal #00B89F → entregado
      aria-label={t('statusDelivered')}
    />
  ) : (
    <Check
      className="h-3.5 w-3.5 text-muted-foreground"  // gris → enviado
      aria-label={t('statusSent')}
    />
  )
)}
```

### Por qué estos colores

| Estado | Color | Razón |
|---|---|---|
| ✓ enviado | `text-muted-foreground` (gris) | Mismo color que la hora — discreto, neutro |
| ✓✓ entregado | `text-[hsl(170,100%,36%)]` (teal #00B89F) | Color accent del proyecto — confirma visualmente el éxito de entrega, igual que WhatsApp usa azul para "leído" |

Ambos colores tienen contraste correcto sobre el fondo del chat tanto en light como dark mode (el teal #00B89F es el color accent oficial del proyecto y se usa para indicadores de éxito/confirmación).

### Verificación

1. Abre la conversación con PRUEBA ENVIO desde tu cuenta (David).
2. Envía un mensaje nuevo → debe aparecer **✓ gris** al lado de la hora, claramente visible.
3. Pídele a la otra persona que abra el chat → en pocos segundos el ✓ debe transformarse en **✓✓ teal** sin recargar la página.
4. Los mensajes recibidos no muestran ningún icono, solo hora.
5. Mensajes pendientes/fallidos siguen mostrando ⏰/⟳/⚠ como antes.

### Nota importante

Los mensajes históricos que enviaste antes de que la otra persona vuelva al chat **seguirán con ✓ gris** hasta que ella abra la conversación. Esto es el comportamiento esperado y correcto — no es un bug, es exactamente cómo funciona WhatsApp.

### Archivos afectados

```text
EDIT  src/components/attendee/DirectChatView.tsx   (5 líneas, solo classNames)
```

Sin migraciones, sin nuevas dependencias, sin cambios en lógica.

