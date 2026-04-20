/**
 * Construye la URL de login del evento de forma robusta.
 *
 * Single source of truth: el secret APP_URL solo debe contener el dominio base
 * (ej: https://congress-connect-app.lovable.app). Sin slug, sin trailing slash.
 *
 * Este helper es defensivo: aunque el secret quede mal configurado (con trailing
 * slash o con el event_code accidentalmente al final), siempre devuelve una URL
 * correcta tipo `${base}/${eventCode}`.
 *
 * Para migrar a otro dominio en el futuro: solo actualizar el secret APP_URL
 * en Supabase. Cero cambios de código.
 */
export function buildEventUrl(eventCode: string): string {
  const FALLBACK = 'https://congress-connect-app.lovable.app';

  const raw = (Deno.env.get('APP_URL') || FALLBACK).trim();

  // 1. Quita trailing slashes
  let base = raw.replace(/\/+$/, '');

  // 2. Si el secret accidentalmente ya incluye el event_code al final, removerlo
  //    (case-insensitive). Evita duplicaciones tipo /ACQFH-2026/ACQFH-2026.
  const trailingCodeRe = new RegExp(`/${escapeRegex(eventCode)}$`, 'i');
  base = base.replace(trailingCodeRe, '');

  return `${base}/${eventCode}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
