

## Diagnóstico: por qué Comercial se ve diferente al resto

Comparé **Comercial** con **Mensajería**, **Tickets**, **Agenda** y **Home** mirando las dos capturas que enviaste y el código. La página Comercial tiene **3 problemas reales** específicos de su layout — no es percepción, es código.

### Problema 1 — Padding superior excesivo

| Página | Padding superior del contenido |
|---|---|
| Agenda | `pt-4` (16px) |
| Mensajería | `pt-4` (16px) |
| Tickets / Home | `pt-4` o `pt-0` |
| **Comercial** | **`py-6` (24px)** ← exceso |

El layout ya reserva `pt-[7.5rem]` (120px) para header + barra de tabs. Comercial agrega 24px más arriba **y abajo**, mientras las otras agregan 16px solo arriba. Por eso el título "Área Comercial" empieza más abajo y siente que "se desperdicia espacio".

### Problema 2 — Grid de 2 columnas en vez de lista vertical

Las otras páginas usan listas verticales de ancho completo (cada ítem ocupa toda la pantalla). Comercial usa `grid-cols-2` siempre, incluso en móvil de 360-400px de ancho. Esto causa:

- Cada tarjeta queda con ~150px de ancho útil
- Logo de 80×80px ocupa la mitad de la tarjeta
- Texto del nombre se aprieta en 2-3 líneas
- Botones "Me interesa" y "Ver más" se ven mini
- Genera scroll horizontal interno en categorías largas como "Equipos Médicos"

En la captura se ve claramente: la segunda tarjeta (con la "PP") queda cortada a la derecha.

### Problema 3 — Header que se ve "diferente"

En realidad **el header es el mismo** (mismo gradiente, mismo logo, mismas dimensiones). Lo que cambia es la **percepción**:

- En Mensajería ves 5 tabs (Inicio, Agenda, Mensajería, Tickets, Comercial) — la barra se ve "completa"
- En Comercial ves solo 3 tabs (Inicio, Agenda, Mensajería) porque el evento de la captura tiene `ticketsEnabled` y `commercialEnabled` apagados — la barra se ve "vacía" y el área negra de fondo domina la vista

Esto es un dato curioso: estás en `/commercial` pero `commercialEnabled=false` en ese evento. El menú de hamburguesa es lo que te llevó ahí. **No es un bug de la página**, es coincidencia.

---

### Propuesta de fix

#### Cambio 1 — Alinear paddings con el resto de páginas

```tsx
// src/pages/attendee/Commercial.tsx
- <div className="px-4 py-6 space-y-4">
+ <div className="px-4 pt-4 pb-6 space-y-4">
```

#### Cambio 2 — Lista vertical en móvil, grid solo en pantallas grandes

Reemplazar el grid fijo por uno responsive y usar una variante de tarjeta horizontal en móvil (logo a la izquierda, info a la derecha, botones abajo). Patrón idéntico al de Contactos:

```tsx
// Contenedor del grupo de patrocinadores
- <div className="grid grid-cols-2 gap-3">
+ <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
```

Y refactor de `SponsorCard` para tener dos layouts:

- **Móvil (`< 640px`)**: tarjeta horizontal — logo 64×64 a la izquierda, nombre + categoría + stand al centro, botones "Me interesa" + "Ver más" apilados a la derecha o debajo
- **Tablet/Desktop (`≥ 640px`)**: tarjeta vertical actual (ya funciona bien con más ancho)

Resultado: cada patrocinador ocupa una fila completa en móvil, texto legible, botones grandes, sin scroll horizontal.

#### Cambio 3 (opcional) — Aclarar incongruencia de tabs

Si `commercialEnabled=false` pero el usuario llega a `/commercial` desde el hamburguesa, actualmente la barra inferior no muestra la tab de Comercial → el usuario se siente "perdido". Dos opciones:

- **A**: Si `commercialEnabled=false`, redirigir `/commercial` → `/home` (consistente, oculta totalmente el módulo).
- **B**: Aceptar el estado actual (el hamburguesa puede ofrecer páginas que no están en la barra). No tocar nada.

Recomiendo **A** para coherencia, pero es decisión tuya.

---

### Archivos afectados

```text
EDIT  src/pages/attendee/Commercial.tsx   — paddings + layout responsive del grid
                                             + refactor SponsorCard con variante móvil
EDIT  src/components/guards/AttendeeRoute.tsx (opcional, solo si eliges Cambio 3-A)
```

Sin migraciones, sin nuevas dependencias, sin cambios en la lógica de datos.

### Verificación

1. Abrir `/commercial` en móvil real (390×844) → cada patrocinador en fila completa, logo a la izquierda, sin scroll horizontal.
2. Abrir en tablet (820×1180) → vuelve a grid de 2 columnas.
3. Abrir en desktop → grid de 2 columnas centrado.
4. Comparar paddings con Agenda y Mensajería → idénticos.
5. Confirmar que el header se ve igual que en las otras páginas (porque siempre lo fue — la única diferencia era visual por la barra de tabs incompleta).

