

## Plan: Agregar dirección al evento de prueba

El evento ACQFH-2026 tiene `venue_name` ("Centro de Convenciones, Medellín") pero `venue_address` es `NULL`, por eso los botones "Abrir en Maps" y "Copiar dirección" no aparecen.

### Cambio

Ejecutar una migración SQL para asignar una dirección al evento:

```sql
UPDATE events 
SET venue_address = 'Calle 41 #55-80, Medellín, Colombia'
WHERE id = '5efca36a-deef-489b-be85-3dc9d1501ed7';
```

Un solo archivo de migración. Sin cambios de código.

