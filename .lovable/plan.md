

## Bug fix: claves i18n faltantes en la pantalla de respuesta de encuestas

### Diagnóstico

En `/{evento}/polls`, después de enviar una respuesta, la tarjeta muestra textos crudos como `polls.responseSent` y `polls.resultsPrivate` en vez del label público. La causa NO es el `poll_type` (verificado en BD: solo hay valores válidos `single_choice`, `multiple_choice`, `rating_scale`, `open_text`, y la traducción de tipo en la cabecera funciona).

La causa real es que `src/pages/attendee/Polls.tsx` invoca dos claves i18n que **no existen** en `src/locales/{es,en}/common.json`:

| Llamada en código | Estado en `common.json` |
|---|---|
| `t('polls.responseSent')` (línea 218) | ❌ Falta — existe `polls.answered` |
| `t('polls.resultsPrivate')` (línea 220) | ❌ Falta por completo |

Cuando i18next no encuentra una clave, devuelve la clave cruda como string. El usuario ve `polls.responseSent` en pantalla, que parece un "nombre técnico de campo".

### Cambios

**1. `src/locales/es/common.json` — añadir claves faltantes en la sección `polls`:**

```json
"responseSent": "Respuesta enviada",
"resultsPrivate": "Los resultados solo los ve el organizador"
```

**2. `src/locales/en/common.json` — paridad:**

```json
"responseSent": "Response sent",
"resultsPrivate": "Results are only visible to the organizer"
```

**3. (Opcional, limpieza) `src/pages/attendee/Polls.tsx`** — `polls.answered` queda huérfano si nadie más lo usa. Lo dejamos por compatibilidad (es texto válido y podría reaparecer en otra vista). No se borra.

### No se modifica

- `POLL_TYPE_KEYS` y la lógica que mapea `poll_type` → label: ya funciona correctamente (verificado en BD y en el namespace `common`).
- Backend, RLS, hooks, servicios: el bug es 100% de capa i18n.
- Otras pantallas (admin, reports, session detail drawer): sus claves de tipo de encuesta están correctas y completas.

### Resultado esperado

- Tras enviar respuesta, el asistente ve "Respuesta enviada" + "Los resultados solo los ve el organizador" en lugar de las claves crudas.
- Funciona en español e inglés.
- Cero impacto en otros módulos.

### Verificación post-deploy (1 paso)

1. Loguear como asistente del evento `ACQFH-2026`.
2. Ir a `/{evento}/polls`, responder cualquier encuesta activa.
3. Confirmar que el bloque post-envío muestra textos legibles, no claves con punto.

