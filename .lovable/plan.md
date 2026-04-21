

## Resumen del rediseño UX/UI — Comercial

Mantenemos exactamente como están **la barra superior de tabs** (Inicio, Agenda, Mensajería, Tickets, Comercial) y **el menú hamburguesa de la izquierda** (≡). No tocamos navegación.

Solo rediseñamos la **página Comercial** y sus tarjetas para resolver el scroll horizontal interno y mejorar legibilidad.

---

### Cambios concretos

#### 1. SponsorCard — toda la tarjeta clickeable, un solo botón visible

```
┌─────────────────────────────────────────────────┐
│  [LOGO]   CLAUDIA PRUEBA                    ›   │  ← tap en cualquier parte → detalle
│   56x56   📍 Stand 2                            │
│           [Farmacéutica]                        │
│                              [♡ Me interesa]    │  ← único botón visible
└─────────────────────────────────────────────────┘
```

- **Toda la card es tappable** y navega al detalle del patrocinador (afford. visual: chevron `›` arriba a la derecha + hover state).
- **Se elimina el botón "Ver más"** → soluciona el overflow horizontal porque ya no hay 2 botones compitiendo por el ancho.
- **Único botón "Me interesa"** abajo a la derecha, ancho `auto` (no `flex-1`), tamaño compacto. `stopPropagation` para no disparar la navegación al detalle.
- Cuando el usuario ya marcó interés → el botón cambia a `♥ Interesado` en color teal (`#00B89F`), deshabilitado.
- **Logo a 56×56** (antes 64×64) para liberar espacio textual.
- **Stand location promovido**: aparece junto al nombre con ícono `MapPin` pequeño en color del nivel.
- **Categoría como chip pequeño** debajo del nombre, padding liviano.

#### 2. Section header de nivel — separadores con jerarquía

Hoy "Oro" es solo un chip suelto. Mejora a divisor de sección:

```
─── 🏆 Oro ──────────────────────────────────────
```

- Ícono según nivel: `Crown` (oro), `Award` (plata), `Medal` (bronce), `Building2` (expositor).
- Color según nivel (amber / slate / orange / slate).
- Línea horizontal a los lados con el color del nivel atenuado.

#### 3. Filtros de categoría — chips con contador

- Cada chip muestra cuántos resultados tiene: `Farmacéutica (3)`, `Tecnología (1)`.
- Chip "Todos" siempre primero con total.
- Chips sin resultados se ocultan automáticamente (no muestra "Educación (0)").
- Estado activo más contrastado: sombra suave + check `✓` a la izquierda.

#### 4. Búsqueda — feedback inmediato

- Botón `✕` para limpiar (aparece solo cuando hay texto).
- Debajo del input: contador "X resultados" cuando hay búsqueda o filtro activo.

---

### Mockup final del módulo (móvil 360px)

```
  Área Comercial
  Patrocinadores y expositores

  ┌────────────────────────────────────────┐
  │ 🔍  Buscar patrocinador...          ✕ │
  └────────────────────────────────────────┘
  3 resultados

  [✓ Todos (3)] [Farmacéutica (3)] [Tecnología (1)]

  ─── 🏆 Oro ──────────────────────────────

  ┌────────────────────────────────────────┐
  │ [LOGO]  CLAUDIA PRUEBA              ›  │
  │  56x56  📍 Stand 2                     │
  │         [Farmacéutica]                 │
  │                        [♡ Me interesa] │
  └────────────────────────────────────────┘

  ┌────────────────────────────────────────┐
  │  LA   Laboratorios ABC              ›  │
  │       📍 Stand A-15                    │
  │       [Farmacéutica]                   │
  │                        [♥ Interesado]  │
  └────────────────────────────────────────┘
```

En tablet/desktop (≥640px) se mantiene el grid de 2 columnas con la card vertical actual.

---

### Archivos afectados

```text
EDIT  src/pages/attendee/Commercial.tsx     — refactor SponsorCard + section headers
                                               + filtros con contador + búsqueda con ✕ y feedback
EDIT  src/locales/es/commercial.json        — keys: searchResults, interestedShort, clearSearch
EDIT  src/locales/en/commercial.json        — mismo set en inglés
```

Sin cambios en navegación. Sin migraciones DB. Sin nuevas dependencias. Sin cambios en `BottomNav` ni `HamburgerMenu`. Mantiene servicios y RLS actuales.

---

### Verificación

1. Abrir `/commercial` en móvil 360×800 → cada card en una fila, sin scroll horizontal interno.
2. Tap en cualquier parte del card (logo, nombre, área vacía) → abre detalle.
3. Tap en "Me interesa" → abre dialog de consentimiento sin abrir detalle.
4. Después de marcar interés → botón cambia a `♥ Interesado` teal.
5. Buscar "claud" → muestra "1 resultado" + botón ✕ visible.
6. Tap en ✕ → limpia búsqueda, vuelve a mostrar todos.
7. Filtrar por categoría → contador de resultados se actualiza.
8. Categorías sin patrocinadores no aparecen como chip.
9. Tablet 820px → vuelve a grid de 2 columnas con card vertical.
10. Modo oscuro: contraste de cards, chips, separadores de nivel — todo legible.

