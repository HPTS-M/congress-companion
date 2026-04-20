

## Bug fix: mostrar la respuesta seleccionada después de enviar (encuestas de selección)

### Diagnóstico

En `src/pages/attendee/Polls.tsx` (líneas 213-227), el bloque de confirmación post-envío solo renderiza la respuesta del usuario cuando el tipo es `open_text`:

```tsx
{isOpen && poll.my_response?.text_response && ( … )}
```

Para `single_choice`, `multiple_choice` y `rating_scale` no se muestra nada de lo que el usuario eligió — solo el mensaje genérico "Respuesta enviada". Esto da la sensación de que la selección "no se visualizó".

Además, en `src/services/polls.service.ts` (`getActivePolls`), cuando hay varias filas para `multiple_choice` el reduce sobrescribe y solo guarda la **última** opción del usuario:

```ts
for (const r of myResponses || []) {
  myResponseByPoll[r.poll_id] = { option_id: r.option_id, text_response: r.text_response };
}
```

Esto debe corregirse para soportar múltiples option_ids.

### Cambios

#### 1. `src/services/polls.service.ts`

- Cambiar la forma de `AttendeePoll.my_response` de:
  ```ts
  my_response?: { option_id: string | null; text_response: string | null } | null;
  ```
  a:
  ```ts
  my_response?: { option_ids: string[]; text_response: string | null } | null;
  ```
- Agrupar las filas de `myResponses` en un array de `option_ids` por poll en lugar de sobrescribir.

#### 2. `src/pages/attendee/Polls.tsx`

- Actualizar el bloque de confirmación (líneas 213-227) para que también muestre la respuesta del usuario cuando el tipo sea `single_choice`, `multiple_choice` o `rating_scale`:
  - Resolver los `option_ids` contra `poll.options` para obtener los `option_text`.
  - Para `rating_scale`, mostrar el número (1-5) y opcionalmente la etiqueta de `RATING_LABELS` traducida.
  - Para `single_choice`: una sola opción resaltada con un check.
  - Para `multiple_choice`: lista (chips) de las opciones seleccionadas.
  - Reutilizar el mismo contenedor visual usado hoy para `open_text` (`rounded-md bg-background p-2 border border-border` con label "Tu respuesta") para mantener consistencia.
- Mantener el texto "Resultados privados" arriba.

#### 3. i18n — `src/locales/es/common.json` y `en/common.json`

Añadir bajo `polls`:
- `yourSelection`: "Tu selección" / "Your selection"
- (reutilizar `yourResponse` ya existente para coherencia visual; se puede usar el mismo)

### Resultado esperado

Después de enviar una encuesta de selección única, el card muestra:
- ✅ "Respuesta enviada"
- "Resultados privados…"
- **"Tu respuesta: [Texto de la opción elegida]"** ← nuevo, visible igual que en open_text

Para `multiple_choice` se muestran todas las opciones elegidas como badges. Para `rating_scale`, el número con su etiqueta. La data se carga correctamente desde el servicio (sin perder selecciones múltiples).

### Consideraciones

- Cambio puramente UI + capa de servicio; sin migraciones de BD ni cambios en RLS.
- Compatible con el estado optimista `justSubmitted`: tras refetch (que `submitResponse.onSuccess` ya invalida), `poll.my_response.option_ids` llegará con la(s) opción(es) recién votadas.
- No se exponen agregados ni votos de otros usuarios — se mantiene la regla de privacidad de resultados.

