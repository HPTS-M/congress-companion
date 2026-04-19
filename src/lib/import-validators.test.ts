import { describe, it, expect } from 'vitest';
import {
  NAME_REGEX,
  EMAIL_REGEX,
  EXTERNAL_CODE_REGEX,
  TEXT_NO_SPECIAL_REGEX,
  mapStatusId,
  normalizeRow,
  validateRow,
  classifyRow,
  applyNoAplica,
} from './import-validators';

describe('import-validators · regex', () => {
  it('NAME_REGEX accepts accented Spanish names', () => {
    expect(NAME_REGEX.test('Dr. Juan Pérez')).toBe(true);
    expect(NAME_REGEX.test('María José Núñez-García')).toBe(true);
    expect(NAME_REGEX.test("O'Brien")).toBe(true);
  });
  it('NAME_REGEX rejects digits and special chars', () => {
    expect(NAME_REGEX.test('Juan123')).toBe(false);
    expect(NAME_REGEX.test('Juan@Perez')).toBe(false);
    expect(NAME_REGEX.test('')).toBe(false);
  });

  it('EMAIL_REGEX validates strict email format', () => {
    expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
    expect(EMAIL_REGEX.test('a@b.co')).toBe(true);
    expect(EMAIL_REGEX.test('bad@')).toBe(false);
    expect(EMAIL_REGEX.test('bad')).toBe(false);
    expect(EMAIL_REGEX.test('bad@a.b')).toBe(false); // TLD < 2 chars
  });

  it('EXTERNAL_CODE_REGEX accepts alphanumeric/dash/underscore 3-50', () => {
    expect(EXTERNAL_CODE_REGEX.test('EXT-001234')).toBe(true);
    expect(EXTERNAL_CODE_REGEX.test('AB_12')).toBe(true);
    expect(EXTERNAL_CODE_REGEX.test('AB')).toBe(false); // too short
    expect(EXTERNAL_CODE_REGEX.test('with space')).toBe(false);
    expect(EXTERNAL_CODE_REGEX.test('emoji😀')).toBe(false);
  });

  it('TEXT_NO_SPECIAL_REGEX accepts common text', () => {
    expect(TEXT_NO_SPECIAL_REGEX.test('Cardiología')).toBe(true);
    expect(TEXT_NO_SPECIAL_REGEX.test('Hospital General S.A.')).toBe(true);
    expect(TEXT_NO_SPECIAL_REGEX.test('Bad@Text')).toBe(false);
  });
});

describe('import-validators · mapStatusId', () => {
  it('maps numeric status correctly', () => {
    expect(mapStatusId(1)).toBe('confirmed');
    expect(mapStatusId(2)).toBe('pending');
    expect(mapStatusId(3)).toBe('cancelled');
    expect(mapStatusId('1')).toBe('confirmed');
  });
  it('returns pending for empty', () => {
    expect(mapStatusId('')).toBe('pending');
    expect(mapStatusId(null)).toBe('pending');
    expect(mapStatusId(undefined)).toBe('pending');
  });
  it('returns null for invalid', () => {
    expect(mapStatusId(5)).toBeNull();
    expect(mapStatusId('abc')).toBeNull();
  });
});

describe('import-validators · normalizeRow (header aliases)', () => {
  it('reads new Spanish headers', () => {
    const row = normalizeRow({
      'Nombre completo': ' Dr. Juan Pérez ',
      Email: 'juan@ejemplo.com',
      'Código credencial': 'EXT-001',
      Especialidad: 'Cardiología',
      Institución: 'Hospital General',
      Estado: '1',
    });
    expect(row.full_name).toBe('Dr. Juan Pérez');
    expect(row.email).toBe('juan@ejemplo.com');
    expect(row.external_credential_code).toBe('EXT-001');
    expect(row.registration_status_raw).toBe('1');
  });
  it('falls back to legacy English headers', () => {
    const row = normalizeRow({
      full_name: 'Jane Doe',
      email: 'jane@x.com',
      specialty: 'Pediatrics',
      institution: 'Clinic',
    });
    expect(row.full_name).toBe('Jane Doe');
    expect(row.specialty).toBe('Pediatrics');
  });
});

describe('import-validators · validateRow', () => {
  it('valid row produces no errors', () => {
    const r = validateRow(
      normalizeRow({
        'Nombre completo': 'Dr. Juan Pérez',
        Email: 'juan@ejemplo.com',
        'Código credencial': 'EXT-001',
        Especialidad: 'Cardiología',
        Institución: 'Hospital',
        Estado: '1',
      }),
      { externalCredentialsRequired: true },
    );
    expect(r.errors).toHaveLength(0);
    expect(r.registration_status).toBe('confirmed');
  });

  it('accumulates multiple errors', () => {
    const r = validateRow(
      normalizeRow({
        'Nombre completo': '',
        Email: 'not-email',
        'Código credencial': 'AB',
        Especialidad: 'Bad@Special',
        Institución: '',
        Estado: '9',
      }),
      { externalCredentialsRequired: true },
    );
    const fields = r.errors.map((e) => e.field);
    expect(fields).toContain('full_name');
    expect(fields).toContain('email');
    expect(fields).toContain('external_credential_code');
    expect(fields).toContain('specialty');
    expect(fields).toContain('registration_status_id');
  });

  it('skips external_credential_code when toggle OFF', () => {
    const r = validateRow(
      normalizeRow({
        'Nombre completo': 'Juan',
        Email: 'a@b.co',
        Estado: '2',
      }),
      { externalCredentialsRequired: false },
    );
    expect(r.errors).toHaveLength(0);
  });
});

describe('import-validators · classifyRow + applyNoAplica', () => {
  it('blocks when name invalid (full_name required)', () => {
    const validated = validateRow(
      normalizeRow({ 'Nombre completo': '', Email: 'bad', Estado: '1' }),
      { externalCredentialsRequired: false },
    );
    const cls = classifyRow(validated, { externalCredentialsEnabled: false });
    expect(cls.blocked).toBe(true);
    expect(cls.blockingErrors.some((e) => e.field === 'full_name')).toBe(true);
  });

  it('email format invalid is blocking', () => {
    const validated = validateRow(
      normalizeRow({ 'Nombre completo': 'Juan Pérez', Email: 'not-an-email', Estado: '1' }),
      { externalCredentialsRequired: false },
    );
    const cls = classifyRow(validated, { externalCredentialsEnabled: false });
    expect(cls.blocked).toBe(true);
    expect(cls.blockingErrors.some((e) => e.field === 'email')).toBe(true);
  });

  it('does NOT block on permissive errors only — applies NO APLICA', () => {
    const validated = validateRow(
      normalizeRow({
        'Nombre completo': 'Juan Pérez',
        Email: 'juan@x.co',
        Especialidad: 'Bad@Special',
        Institución: 'Bad@Inst',
        Estado: '1',
      }),
      { externalCredentialsRequired: false },
    );
    const cls = classifyRow(validated, { externalCredentialsEnabled: false });
    expect(cls.blocked).toBe(false);
    expect(cls.permissiveErrors.length).toBe(2);
    const fixed = applyNoAplica(validated, cls.permissiveErrors);
    expect(fixed.specialty).toBe('NO APLICA');
    expect(fixed.institution).toBe('NO APLICA');
  });

  it('blocks when external code required and invalid (always blocking)', () => {
    const validated = validateRow(
      normalizeRow({
        'Nombre completo': 'Juan Pérez',
        Email: 'juan@x.co',
        'Código credencial': '',
        Estado: '1',
      }),
      { externalCredentialsRequired: true },
    );
    const cls = classifyRow(validated, { externalCredentialsEnabled: true });
    expect(cls.blocked).toBe(true);
    expect(cls.blockingErrors.some((e) => e.field === 'external_credential_code')).toBe(true);
  });
});
