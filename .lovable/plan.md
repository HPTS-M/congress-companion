

El usuario quiere la mejor solución: que funcione, siga buenas prácticas, y sea fácil de cambiar cuando migre a otro dominio. Voy a proponer un plan limpio y minimalista.

Estrategia recomendada:
1. **Single source of truth**: el secret `APP_URL` solo contiene el dominio base (sin slug, sin trailing slash). Punto.
2. **Código defensivo y centralizado**: helper compartido que sanitiza el `APP_URL` y construye el link del evento. Si en el futuro alguien guarda mal el secret, el helper lo arregla.
3. **Un solo lugar para cambiar de dominio**: solo se actualiza el secret `APP_URL` en Supabase. Cero cambios de código necesarios.

Voy a mantenerlo conciso.

