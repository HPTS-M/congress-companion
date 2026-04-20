/**
 * Construye la URL de login del evento de forma robusta.
 *
 * Single source of truth: el secret APP_URL solo debe contener el dominio base
 * (ej: https://congress-connect-app.lovable.app). Sin slug, sin trailing slash.
 *
 * Este helper es defensivo: aunque el secret quede mal configurado (con trailing
 * slashes o con el event_code accidentalmente repetido al final), siempre
 * devuelve una URL correcta tipo `${base}/${eventCode}`.
 *
 * Para migrar a otro dominio en el futuro: solo actualizar el secret APP_URL
 * en Supabase. Cero cambios de código.
 */
export function buildEventUrl(eventCode: string): string {
  const base = buildBaseUrl(eventCode);
  return `${base}/${eventCode}`;
}

/**
 * Devuelve solo la base limpia (sin event_code y sin trailing slashes).
 * Útil para portales que no usan el event_code en la URL (ej: /provider).
 *
 * Si se pasa un eventCode opcional, también limpia ocurrencias trailing
 * accidentales de ese código en el secret APP_URL.
 */
export function buildBaseUrl(eventCode?: string): string {
  const FALLBACK = 'https://congress-connect-app.lovable.app';
  const raw = (Deno.env.get('APP_URL') || FALLBACK).trim();

  let base = raw;
  const codeRe = eventCode ? new RegExp(`/${escapeRegex(eventCode)}/?$`, 'i') : null;

  // Loop defensivo: limpiar repetidamente trailing slashes y duplicaciones
  // de event_code accidentalmente añadidas al secret.
  // Cap a 10 iteraciones para evitar cualquier loop infinito teórico.
  for (let i = 0; i < 10; i++) {
    const before = base;
    // 1. Quitar trailing slashes
    base = base.replace(/\/+$/, '');
    // 2. Quitar trailing /eventCode si aplica
    if (codeRe) {
      base = base.replace(codeRe, '');
    }
    if (base === before) break;
  }

  return base;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
