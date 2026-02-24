import { writeExcelFile, readExcelFile } from '@/lib/excel';
import type { SponsorRow } from './admin-sponsors.service';

const LEVEL_MAP: Record<string, string> = {
  'Oro': 'gold', 'Gold': 'gold', 'oro': 'gold', 'gold': 'gold',
  'Plata': 'silver', 'Silver': 'silver', 'plata': 'silver', 'silver': 'silver',
  'Bronce': 'bronze', 'Bronze': 'bronze', 'bronce': 'bronze', 'bronze': 'bronze',
  'Expositor': 'exhibitor', 'Exhibitor': 'exhibitor', 'expositor': 'exhibitor', 'exhibitor': 'exhibitor',
};

const LEVEL_DISPLAY: Record<string, string> = {
  gold: 'Oro', silver: 'Plata', bronze: 'Bronce', exhibitor: 'Expositor',
};

const VALID_CATEGORIES = ['pharmaceutical', 'technology', 'medical_equipment', 'services', 'education', 'other'];

const CATEGORY_MAP: Record<string, string> = {
  'Farmacéutica': 'pharmaceutical', 'Farmaceutica': 'pharmaceutical', 'pharmaceutical': 'pharmaceutical',
  'Tecnología': 'technology', 'Tecnologia': 'technology', 'technology': 'technology',
  'Equipos Médicos': 'medical_equipment', 'Equipos Medicos': 'medical_equipment', 'medical_equipment': 'medical_equipment',
  'Servicios': 'services', 'services': 'services',
  'Educación': 'education', 'Educacion': 'education', 'education': 'education',
  'Otro': 'other', 'other': 'other',
};

const CATEGORY_DISPLAY: Record<string, string> = {
  pharmaceutical: 'Farmacéutica', technology: 'Tecnología', medical_equipment: 'Equipos Médicos',
  services: 'Servicios', education: 'Educación', other: 'Otro',
};

export interface SponsorImportRow {
  nombre: string;
  nivel: string;
  categoria: string;
  stand: string;
  website: string;
  email_contacto: string;
  whatsapp: string;
  descripcion: string;
  linkedin: string;
  instagram: string;
}

export interface ValidatedSponsorRow extends SponsorImportRow {
  isValid: boolean;
  errors: string[];
  mappedLevel?: string;
  mappedCategory?: string;
}

export async function exportSponsorsToExcel(sponsors: SponsorRow[], eventName: string): Promise<void> {
  await writeExcelFile({
    filename: `patrocinadores-${eventName.replace(/\s+/g, '-').toLowerCase()}.xlsx`,
    sheetName: 'Patrocinadores',
    columns: [
      { header: 'nombre', key: 'nombre', width: 30 },
      { header: 'nivel', key: 'nivel', width: 12 },
      { header: 'categoria', key: 'categoria', width: 20 },
      { header: 'stand', key: 'stand', width: 15 },
      { header: 'website', key: 'website', width: 30 },
      { header: 'email_contacto', key: 'email_contacto', width: 25 },
      { header: 'whatsapp', key: 'whatsapp', width: 18 },
      { header: 'descripcion', key: 'descripcion', width: 40 },
      { header: 'linkedin', key: 'linkedin', width: 30 },
      { header: 'instagram', key: 'instagram', width: 30 },
    ],
    rows: sponsors.map(s => ({
      nombre: s.name,
      nivel: LEVEL_DISPLAY[s.level] ?? s.level,
      categoria: CATEGORY_DISPLAY[s.category] ?? s.category,
      stand: s.stand_location ?? '',
      website: s.website_url ?? '',
      email_contacto: s.contact_email ?? '',
      whatsapp: s.whatsapp ?? '',
      descripcion: s.description ?? '',
      linkedin: s.social_linkedin ?? '',
      instagram: s.social_instagram ?? '',
    })),
  });
}

export async function downloadSponsorTemplate(): Promise<void> {
  await writeExcelFile({
    filename: 'plantilla-patrocinadores.xlsx',
    sheetName: 'Patrocinadores',
    columns: [
      { header: 'nombre', key: 'nombre', width: 30 },
      { header: 'nivel', key: 'nivel', width: 12 },
      { header: 'categoria', key: 'categoria', width: 20 },
      { header: 'stand', key: 'stand', width: 15 },
      { header: 'website', key: 'website', width: 30 },
      { header: 'email_contacto', key: 'email_contacto', width: 25 },
      { header: 'whatsapp', key: 'whatsapp', width: 18 },
      { header: 'descripcion', key: 'descripcion', width: 40 },
      { header: 'linkedin', key: 'linkedin', width: 30 },
      { header: 'instagram', key: 'instagram', width: 30 },
    ],
    rows: [
      {
        nombre: 'Laboratorios ABC',
        nivel: 'Oro',
        categoria: 'Farmacéutica',
        stand: 'A-15',
        website: 'https://abc.com',
        email_contacto: 'contacto@abc.com',
        whatsapp: '573001234567',
        descripcion: 'Líder en innovación farmacéutica',
        linkedin: 'https://linkedin.com/company/abc',
        instagram: 'https://instagram.com/abc',
      },
    ],
  });
}

export async function parseSponsorFile(file: File): Promise<SponsorImportRow[]> {
  const raw = await readExcelFile<Record<string, unknown>>(file);
  return raw.map(r => ({
    nombre: String(r['nombre'] ?? r['Nombre'] ?? '').trim(),
    nivel: String(r['nivel'] ?? r['Nivel'] ?? '').trim(),
    categoria: String(r['categoria'] ?? r['Categoria'] ?? r['categoría'] ?? r['Categoría'] ?? '').trim(),
    stand: String(r['stand'] ?? r['Stand'] ?? '').trim(),
    website: String(r['website'] ?? r['Website'] ?? '').trim(),
    email_contacto: String(r['email_contacto'] ?? r['Email'] ?? r['email'] ?? '').trim(),
    whatsapp: String(r['whatsapp'] ?? r['WhatsApp'] ?? r['Whatsapp'] ?? '').trim(),
    descripcion: String(r['descripcion'] ?? r['Descripcion'] ?? r['descripción'] ?? '').trim(),
    linkedin: String(r['linkedin'] ?? r['LinkedIn'] ?? '').trim(),
    instagram: String(r['instagram'] ?? r['Instagram'] ?? '').trim(),
  }));
}

export function validateSponsorRows(rows: SponsorImportRow[]): ValidatedSponsorRow[] {
  return rows.map(row => {
    const errors: string[] = [];
    if (!row.nombre) errors.push('Nombre requerido');
    if (!row.nivel) errors.push('Nivel requerido');

    const mappedLevel = LEVEL_MAP[row.nivel];
    if (row.nivel && !mappedLevel) errors.push(`Nivel inválido: ${row.nivel}`);

    const mappedCategory = row.categoria ? CATEGORY_MAP[row.categoria] : 'other';
    if (row.categoria && !CATEGORY_MAP[row.categoria]) errors.push(`Categoría inválida: ${row.categoria}`);

    return {
      ...row,
      isValid: errors.length === 0,
      errors,
      mappedLevel,
      mappedCategory: mappedCategory || 'other',
    };
  });
}
