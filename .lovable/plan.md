

## Plan: Pantalla de error amigable con auto-recuperación

### Qué resuelve
Cuando algo falla y se rompe la app, hoy el usuario ve solo *"Something went wrong"* sobre fondo oscuro, sin idioma, sin acción. Queda atrapado. Vamos a reemplazar esa pantalla por una experiencia amigable, en su idioma, que se auto-recupera sola en la mayoría de casos.

---

### Cómo se verá

```text
┌──────────────────────────────────────┐
│                                      │
│        [Logo CONGRÉSSAPP]            │
│                                      │
│              ⚠ (icono)               │
│                                      │
│   Algo no salió como esperábamos     │
│                                      │
│   No te preocupes, esto suele        │
│   resolverse al refrescar.           │
│   Tu sesión y tus datos están        │
│   seguros.                           │
│                                      │
│   Reintentando en 5 s…               │
│                                      │
│   [  Refrescar ahora  ]              │
│   [  Volver al inicio ]              │
│                                      │
│   ID del error: a1b2c3 · Copiar      │
└──────────────────────────────────────┘
```

---

### Cambios

#### 1. Nuevo componente `src/components/ErrorFallback.tsx`
Pantalla full-screen con:
- Logo CONGRÉSSAPP arriba (consistencia de marca).
- Icono `AlertTriangle` en círculo `bg-accent/10` color teal `#00B89F`.
- Título empático y mensaje tranquilizador (ver textos en sección i18n).
- **Cuenta regresiva visible** de 5 s para auto-reintento.
- Botón primario **"Refrescar ahora"** (`window.location.reload()`).
- Botón secundario **"Volver al inicio"** (`window.location.href = '/'`).
- ID técnico de Sentry al pie, copiable, para soporte.

#### 2. Auto-recuperación inteligente
- Auto-reload tras **5 segundos** la primera vez que se monta el fallback.
- Si `navigator.onLine === false` → no recarga, muestra *"Esperando conexión a internet…"* y espera al evento `online` del navegador.
- `sessionStorage.errorReloadAttempts`:
  - Tras **2 intentos en menos de 60 s** → cancela auto-reload, deja solo botones manuales (evita loop infinito).
  - Se limpia si la app vive >60 s sin error.

#### 3. Diseño (alineado al design system)
- Fondo `bg-background` (respeta light/dark automático).
- Card centrado, max-width 400 px, `rounded-2xl`, `shadow-lg`, padding 24.
- Botón primario `bg-primary` (#1A56A0) blanco · secundario `variant="outline"`.
- Mobile-first 360 px en adelante.

#### 4. i18n — claves nuevas en `common.json`

```json
"errorFallback": {
  "title": "Algo no salió como esperábamos",
  "message": "No te preocupes, esto suele resolverse al refrescar. Tu sesión y tus datos están seguros.",
  "autoRetry": "Reintentando automáticamente en {{seconds}} s…",
  "offlineWaiting": "Esperando conexión a internet…",
  "maxAttemptsReached": "Si el problema continúa, intenta más tarde o contacta al organizador.",
  "refreshNow": "Refrescar ahora",
  "goHome": "Volver al inicio",
  "errorId": "ID del error: {{id}}",
  "copyId": "Copiar ID",
  "idCopied": "ID copiado"
}
```

Versión EN equivalente.

#### 5. Integración en `src/main.tsx`
Reemplazar el fallback inline:

```tsx
<Sentry.ErrorBoundary
  fallback={({ resetError, eventId }) => (
    <ErrorFallback resetError={resetError} eventId={eventId} />
  )}
>
  <App />
</Sentry.ErrorBoundary>
```

#### 6. Edge case — fallback de emergencia
Si `i18n.isInitialized === false` (error muy temprano antes de cargar traducciones), el componente usa textos hardcoded en español como último recurso. Caso raro pero cubierto.

---

### Best practices aplicadas

1. **Tono empático** — sin lenguaje técnico ni alarmante.
2. **Acción clara** — botón primario destacado.
3. **Auto-recuperación con límite** — evita loops infinitos.
4. **Respeta estado offline** — no recarga sin red.
5. **Trazabilidad** — `eventId` de Sentry copiable para soporte.
6. **i18n estricto + fallback de emergencia**.
7. **Dark mode automático** vía Tailwind.
8. **Mobile-first** 360 px.
9. **Accesibilidad** — `role="alert"`, `aria-live="assertive"`, foco automático en botón primario.
10. **Sin dependencias nuevas** — solo `lucide-react` ya instalado.

---

### Archivos afectados

```text
NUEVO  src/components/ErrorFallback.tsx
EDIT   src/main.tsx                   — usar ErrorFallback
EDIT   src/locales/es/common.json     — claves errorFallback.*
EDIT   src/locales/en/common.json     — claves errorFallback.*
```

Sin migraciones SQL, sin nuevas dependencias.

---

### Verificación

1. Forzar un error temporal (`throw new Error('test')` en algún componente).
2. Aparece pantalla amigable con logo, mensaje y cuenta regresiva.
3. A los 5 s recarga sola.
4. Disparar el error 2 veces seguidas → la cuenta regresiva desaparece, solo quedan botones manuales y mensaje de "intenta más tarde".
5. Modo avión → forzar error → muestra *"Esperando conexión a internet…"* en lugar de la cuenta regresiva. Al volver el internet, recarga.
6. Cambiar idioma a EN → forzar error → todo en inglés.
7. Cambiar tema del SO a dark → colores correctos.
8. Probar el botón "Copiar ID" → toast de confirmación.

