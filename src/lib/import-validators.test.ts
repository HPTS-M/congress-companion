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

  it('NAME_REGEX accepts uppercase accents and Latin extended', () => {
    expect(NAME_REGEX.test('JHON MAICOL LÓPEZ FLORIAN')).toBe(true);
    expect(NAME_REGEX.test('JOSÉ ÁNGEL ÍÑIGUEZ')).toBe(true);
    expect(NAME_REGEX.test('FRANÇOIS')).toBe(true);
  });

  it('TEXT_NO_SPECIAL_REGEX accepts uppercase accents and long institutions', () => {
    expect(TEXT_NO_SPECIAL_REGEX.test('QUÍMICO FARMACÉUTICO')).toBe(true);
    expect(TEXT_NO_SPECIAL_REGEX.test('H. SOC DE ONCOLOGIA Y HEMATOLOGIA D')).toBe(true);
    expect(TEXT_NO_SPECIAL_REGEX.test('CLIN. DEL ROSARIO TESORO')).toBe(true);
    expect(TEXT_NO_SPECIAL_REGEX.test('MED+ S.A.S.')).toBe(true);
  });
});

describe('import-validators · normalizeRow Unicode space handling', () => {
  it('strips non-breaking spaces (\\u00A0) and collapses whitespace', () => {
    const row = normalizeRow({
      'Nombre completo': 'Juan\u00A0Pérez\u00A0 ',
      Email: 'j@x.co',
      Estado: '1',
    });
    expect(row.full_name).toBe('Juan Pérez');
  });

  it('accepts numeric external code from Excel (10851)', () => {
    const row = normalizeRow({
      'Nombre completo': 'JHON MAICOL LÓPEZ FLORIAN',
      Email: 'j@x.co',
      'Código credencial': 10851,
      Especialidad: 'QUÍMICO FARMACÉUTICO',
      'Institución': 'FUNDACION VALLE DE LILI',
      Estado: '1',
    });
    expect(row.external_credential_code).toBe('10851');
    const r = validateRow(row, { externalCredentialsRequired: true });
    expect(r.errors).toHaveLength(0);
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
  it('reads "Código del congreso" header (template alias)', () => {
    const row = normalizeRow({
      'Nombre completo': 'LEIDY YOHAN PALACIO',
      Email: 'leidy@x.co',
      'Código del congreso': 10851,
      Especialidad: 'FARMACIA',
      Institución: 'GLOBAL SERVICE',
      Estado: 1,
    });
    expect(row.external_credential_code).toBe('10851');
  });
  it('matches header case-insensitively and ignoring accents', () => {
    const row = normalizeRow({
      'NOMBRE COMPLETO': 'Juan Pérez',
      EMAIL: 'j@x.co',
      'CODIGO DEL CONGRESO': 'ABC-123',
      ESTADO: 1,
    });
    expect(row.full_name).toBe('Juan Pérez');
    expect(row.email).toBe('j@x.co');
    expect(row.external_credential_code).toBe('ABC-123');
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

  it('accumulates multiple errors (external code format no longer validated)', () => {
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
    expect(fields).toContain('specialty');
    expect(fields).toContain('registration_status_id');
    // external_credential_code 'AB' is now accepted (no format validation)
    expect(fields).not.toContain('external_credential_code');
  });

  it('accepts any external_credential_code format when present', () => {
    const cases = ['CMP 12345', 'NIT-900.123.456', '12', 'código-ñ-001', 'with spaces!@#'];
    for (const code of cases) {
      const r = validateRow(
        normalizeRow({
          'Nombre completo': 'Juan Pérez',
          Email: 'juan@x.co',
          'Código credencial': code,
          Estado: '1',
        }),
        { externalCredentialsRequired: true },
      );
      expect(r.errors.filter((e) => e.field === 'external_credential_code')).toHaveLength(0);
    }
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
