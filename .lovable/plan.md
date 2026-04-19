

El usuario quiere guardar el análisis del CSV vs schema actual de attendees como memoria persistente del proyecto, para retomarlo después mientras trabaja en otro aspecto.

Reviso el index de memoria — no existe entrada para esta extensión de campos de attendees. Crearé un memory file específico.

## Plan: Guardar análisis de extensión de attendees como memoria del proyecto

### Qué se va a guardar

Crear `mem://features/attendee-extended-fields-analysis` con:
- Comparativa CSV externo vs schema `attendees` actual (tabla de mapeo de 13 campos)
- Estrategia híbrida aprobada: 5 columnas universales + JSON `metadata` para event-specific
- Migración SQL pendiente (columnas, trigger full_name, índice GIN)
- Lista de archivos a tocar (10 items, orden backend-first)
- Preguntas pendientes sin responder:
  1. ¿STAFF/PATROCINADO/EXTRANJERO requieren permisos diferenciados (vincular a roles)?
  2. ¿De qué sistema viene el `Id` externo (10611) y es estable para sync?
  3. ¿Importación con flujo especial separado o detección automática del formato extendido?
- Plan de verificación (10 puntos)
- Estado: **pendiente — esperando respuestas a las 3 preguntas antes de implementar**

### Actualizar `mem://index.md`

Añadir referencia en la sección Memorias:
`- [Attendee Extended Fields](mem://features/attendee-extended-fields-analysis) — Análisis comparativo CSV externo vs schema, estrategia híbrida (columnas universales + metadata JSON), pendiente de implementar.`

### Archivos a crear/modificar (en modo default)
1. Crear `mem://features/attendee-extended-fields-analysis` con frontmatter `type: feature`
2. Actualizar `mem://index.md` añadiendo la referencia (preservando todo el contenido existente)

### Resultado
Cuando el usuario regrese a este tema en cualquier sesión futura, bastará con que mencione "extender campos de attendees" o "importar CSV con categorías" y la memoria estará disponible para retomar exactamente donde quedó, con las 3 preguntas pendientes visibles.

