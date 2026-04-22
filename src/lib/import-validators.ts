import { z } from 'zod';

/**
 * Centralized Excel/CSV import validators for the attendees module.
 * - Strict regex per field
 * - Numeric status mapping (1/2/3 → confirmed/pending/cancelled)
 * - Header alias map for tolerant parsing (Spanish + legacy English)
 */

// --- Regex ---
// Letters (Latin extended: includes all accents — agudas, graves, diéresis, Ç, ñ),
// spaces, dots, apostrophes (straight + curly), hyphens.
// No digits, no other special characters.
export const NAME_REGEX = /^[A-Za-zÀ-ÿÑñ\s.''’\-]+$/;

// Strict email
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Free-text fields without atypical special characters (allows letters, numbers,
// spaces, Latin extended accents, ñ, common punctuation: . , & ' " – — - ( ) / +)
export const TEXT_NO_SPECIAL_REGEX = /^[A-Za-zÀ-ÿÑñ0-9\s.,&''’""“”–—\-()/+]+$/;

// External credential code: alphanumeric + dash + underscore, 3-50 chars
export const EXTERNAL_CODE_REGEX = /^[A-Za-z0-9_\-]{3,50}$/;

// --- Status mapping ---
export const STATUS_MAP: Record<number, 'confirmed' | 'pending' | 'cancelled'> = {
  1: 'confirmed',
  2: 'pending',
  3: 'cancelled',
};

export type RegistrationStatus = 'confirmed' | 'pending' | 'cancelled';

export function mapStatusId(value: unknown): RegistrationStatus | null {
  if (value === '' || value === null || value === undefined) return 'pending';
  const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n)) return null;
  return STATUS_MAP[n as 1 | 2 | 3] ?? null;
}

// --- Header alias map ---
// Maps internal keys → list of accepted Excel column header strings.
export const HEADER_ALIASES: Record<string, string[]> = {
  full_name: ['Nombre completo', 'nombre_completo', 'full_name', 'nombre', 'Nombre'],
  email: ['Email', 'email', 'correo', 'Correo'],
  external_credential_code: [
    'Código del congreso',
    'Codigo del congreso',
    'código del congreso',
    'codigo del congreso',
    'Código credencial',
    'Codigo credencial',
    'codigo_credencial',
    'credential_code',
    'external_credential_code',
  ],
  specialty: ['Especialidad', 'especialidad', 'specialty', 'Specialty'],
  institution: [
    'Institución',
    'Institucion',
    'institucion',
    'institución',
    'institution',
    'Institution',
  ],
  registration_status_id: ['Estado', 'estado', 'status', 'Status'],
};

/** Normalize a row read from xlsx (raw headers) to internal keys. */
export function normalizeRow(raw: Record<string, unknown>): {
  full_name: string;
  email: string;
  external_credential_code: string;
  specialty: string;
  institution: string;
  registration_status_raw: string;
} {
  const normalizeStr = (s: string): string =>
    s
      .replace(/[\u00A0\u2000-\u200B\u202F\u3000]/g, ' ') // Unicode spaces → normal space
      .replace(/\s+/g, ' ') // collapse multiple spaces
      .trim();

  // Normalize a header for tolerant matching: lowercase, strip accents,
  // collapse whitespace. So "Código del congreso", "CODIGO DEL CONGRESO" and
  // "código  del  congreso" all match the same alias.
  const normalizeHeader = (h: string): string =>
    h
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .replace(/[\u00A0\u2000-\u200B\u202F\u3000]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  // Build a normalized lookup of the raw row once.
  const rawNormalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    rawNormalized[normalizeHeader(k)] = v;
  }

  const pick = (key: keyof typeof HEADER_ALIASES): string => {
    const aliases = HEADER_ALIASES[key];
    for (const alias of aliases) {
      const v = rawNormalized[normalizeHeader(alias)];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        // Excel may deliver numbers (e.g. "Código del congreso" = 10851).
        // For integer-like floats, drop the trailing ".0" (10851.0 → "10851").
        if (typeof v === 'number') {
          return Number.isInteger(v) ? String(v) : normalizeStr(String(v));
        }
        return normalizeStr(String(v));
      }
    }
    return '';
  };

  return {
    full_name: pick('full_name'),
    email: pick('email'),
    external_credential_code: pick('external_credential_code'),
    specialty: pick('specialty'),
    institution: pick('institution'),
    registration_status_raw: pick('registration_status_id'),
  };
}

// --- Per-field validation ---
export type FieldKey =
  | 'full_name'
  | 'email'
  | 'external_credential_code'
  | 'specialty'
  | 'institution'
  | 'registration_status_id';

export interface FieldError {
  field: FieldKey;
  message: string;
}

export interface ValidatedRow {
  full_name: string;
  email: string;
  external_credential_code: string;
  specialty: string;
  institution: string;
  registration_status: RegistrationStatus;
  errors: FieldError[];
}

interface ValidateOptions {
  externalCredentialsRequired: boolean;
}

/**
 * Validate a normalized row. Always returns a ValidatedRow with accumulated
 * field-level errors (never throws). Empty optional fields are OK.
 */
export function validateRow(
  raw: ReturnType<typeof normalizeRow>,
  opts: ValidateOptions,
): ValidatedRow {
  const errors: FieldError[] = [];

  // full_name: required, regex
  if (!raw.full_name) {
    errors.push({ field: 'full_name', message: 'required' });
  } else if (!NAME_REGEX.test(raw.full_name)) {
    errors.push({ field: 'full_name', message: 'invalid_format' });
  }

  // email: required, strict format
  if (!raw.email) {
    errors.push({ field: 'email', message: 'required' });
  } else if (!EMAIL_REGEX.test(raw.email)) {
    errors.push({ field: 'email', message: 'invalid_format' });
  }

  // external_credential_code: NO se valida formato — se acepta tal cual venga del Excel.
  // Solo se requiere presencia si el toggle está activo.
  if (opts.externalCredentialsRequired && !raw.external_credential_code) {
    errors.push({ field: 'external_credential_code', message: 'required' });
  }

  // specialty: optional, regex if present
  if (raw.specialty && !TEXT_NO_SPECIAL_REGEX.test(raw.specialty)) {
    errors.push({ field: 'specialty', message: 'invalid_format' });
  }

  // institution: optional, regex if present
  if (raw.institution && !TEXT_NO_SPECIAL_REGEX.test(raw.institution)) {
    errors.push({ field: 'institution', message: 'invalid_format' });
  }

  // registration_status: 1|2|3 (default = pending if blank)
  const status = mapStatusId(raw.registration_status_raw);
  if (status === null) {
    errors.push({ field: 'registration_status_id', message: 'invalid_status' });
  }

  return {
    full_name: raw.full_name,
    email: raw.email,
    external_credential_code: raw.external_credential_code,
    specialty: raw.specialty,
    institution: raw.institution,
    registration_status: status ?? 'pending',
    errors,
  };
}

// --- Bloqueante / Permisivo / Warning rules ---
// Email format invalid is bloqueante; duplicates (file/DB) son warning.
// Código credencial externo: formato O duplicado SIEMPRE bloqueante (identifica al individuo).
export const BLOCKING_FIELDS_ALWAYS: FieldKey[] = ['full_name', 'email'];
export const PERMISSIVE_FIELDS: FieldKey[] = ['specialty', 'institution'];

/**
 * Decide whether a row is fully blocked (must be discarded) or can be inserted
 * with NO APLICA substitutions on permissive fields.
 *
 * Note: this only classifies *format* errors from `validateRow`. Duplicate
 * checks (email duplicate = warning, external_code duplicate = blocking) are
 * applied externally by the caller after cross-row/DB lookup.
 */
export function classifyRow(
  row: ValidatedRow,
  opts: { externalCredentialsEnabled: boolean },
): { blocked: boolean; blockingErrors: FieldError[]; permissiveErrors: FieldError[] } {
  const blockingFields = new Set<FieldKey>(BLOCKING_FIELDS_ALWAYS);
  if (opts.externalCredentialsEnabled) blockingFields.add('external_credential_code');
  // Status invalid is also blocking (cannot guess intent)
  blockingFields.add('registration_status_id');

  const blockingErrors = row.errors.filter((e) => blockingFields.has(e.field));
  const permissiveErrors = row.errors.filter((e) =>
    PERMISSIVE_FIELDS.includes(e.field),
  );

  return {
    blocked: blockingErrors.length > 0,
    blockingErrors,
    permissiveErrors,
  };
}

/** Apply NO APLICA substitution to permissive fields with errors. */
export function applyNoAplica(row: ValidatedRow, permissiveErrors: FieldError[]): ValidatedRow {
  const next = { ...row };
  for (const err of permissiveErrors) {
    if (err.field === 'specialty') next.specialty = 'NO APLICA';
    if (err.field === 'institution') next.institution = 'NO APLICA';
  }
  return next;
}

// Re-export Zod for callers if needed
export { z };
