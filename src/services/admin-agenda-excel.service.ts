import * as XLSX from 'xlsx';
import type { EventActivity, ActivityType } from '@/types';

const TYPE_DISPLAY: Record<string, string> = {
  talk: 'Conferencia',
  workshop: 'Taller',
  ceremony: 'Plenaria',
  other: 'Receso',
  symposium: 'Simposio',
  conference_day: 'Jornada',
  networking: 'Networking',
};

const TYPE_REVERSE: Record<string, ActivityType> = {
  conferencia: 'talk',
  taller: 'workshop',
  plenaria: 'ceremony',
  receso: 'other',
  simposio: 'symposium',
  jornada: 'conference_day',
  networking: 'networking',
};

const VALID_TYPES_DISPLAY = Object.values(TYPE_DISPLAY);

export interface ImportRow {
  dia: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  titulo: string;
  tipo_actividad: string;
  sala: string;
  ponente: string;
  origen_ponente: string;
  descripcion: string;
  tiene_certificado: string;
  capacidad_maxima: string;
}

export interface ValidatedImportRow extends ImportRow {
  valid: boolean;
  errors: string[];
  activityType?: ActivityType;
}

const COLUMNS = [
  'dia', 'fecha', 'hora_inicio', 'hora_fin', 'titulo',
  'tipo_actividad', 'sala', 'ponente', 'origen_ponente',
  'descripcion', 'tiene_certificado', 'capacidad_maxima',
];

const TIME_RE = /^\d{1,2}:\d{2}$/;

function normalizeTime(v: unknown): string {
  if (!v) return '';
  const s = String(v).trim();
  if (TIME_RE.test(s)) {
    const [h, m] = s.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  // Excel might store time as fraction of day
  if (typeof v === 'number' && v < 1) {
    const totalMin = Math.round(v * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return s;
}

export function exportAgendaToExcel(
  activities: EventActivity[],
  eventName: string,
): void {
  const wb = XLSX.utils.book_new();

  // Group by date
  const grouped = new Map<string, EventActivity[]>();
  for (const a of activities) {
    const list = grouped.get(a.scheduled_date) ?? [];
    list.push(a);
    grouped.set(a.scheduled_date, list);
  }
  const sortedDates = Array.from(grouped.keys()).sort();

  const rows: (string | number | null)[][] = [];

  // Header info
  rows.push([`Agenda — ${eventName}`]);
  rows.push([`Exportado: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`]);
  rows.push([]);

  // Column headers
  rows.push([
    'Día', 'Fecha', 'Hora Inicio', 'Hora Fin', 'Título',
    'Tipo Actividad', 'Sala', 'Ponente', 'Origen Ponente',
    'Descripción', 'Tiene Certificado', 'Capacidad Máxima',
  ]);

  let dayNum = 0;
  for (const date of sortedDates) {
    dayNum++;
    if (dayNum > 1) rows.push([]); // blank row between days

    const sessions = grouped.get(date)!;
    sessions.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));

    for (const s of sessions) {
      rows.push([
        dayNum,
        s.scheduled_date,
        s.start_time?.slice(0, 5) ?? '',
        s.end_time?.slice(0, 5) ?? '',
        s.title,
        TYPE_DISPLAY[s.activity_type ?? 'other'] ?? s.activity_type ?? '',
        s.location ?? '',
        s.speaker_name ?? '',
        s.speaker_bio ?? '',
        s.description ?? '',
        s.requires_checkin ? 'SI' : 'NO',
        s.capacity ?? '',
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Set column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 35 },
    { wch: 16 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
    { wch: 40 }, { wch: 18 }, { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
  XLSX.writeFile(wb, `agenda-${eventName.replace(/\s+/g, '_')}.xlsx`);
}

export function downloadAgendaTemplate(): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    'dia', 'fecha', 'hora_inicio', 'hora_fin', 'titulo',
    'tipo_actividad', 'sala', 'ponente', 'origen_ponente',
    'descripcion', 'tiene_certificado', 'capacidad_maxima',
  ];

  const example = [
    1, '2026-04-23', '09:00', '12:00', 'Ejemplo de sesión',
    'Conferencia', 'Sala 1', 'Dr. Nombre Apellido', 'Colombia',
    'Descripción opcional', 'SI', 100,
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 35 },
    { wch: 16 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
    { wch: 40 }, { wch: 18 }, { wch: 16 },
  ];

  // Data validation for tipo_actividad column (col index 5)
  ws['!dataValidation'] = [{
    sqref: 'F2:F1000',
    type: 'list',
    formula1: `"${VALID_TYPES_DISPLAY.join(',')}"`,
  }];

  XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
  XLSX.writeFile(wb, 'plantilla-agenda.xlsx');
}

export function parseAgendaFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const rows: ImportRow[] = json.map((row) => ({
          dia: Number(row['dia'] ?? row['Día'] ?? row['DIA'] ?? 0),
          fecha: String(row['fecha'] ?? row['Fecha'] ?? row['FECHA'] ?? ''),
          hora_inicio: normalizeTime(row['hora_inicio'] ?? row['Hora Inicio'] ?? row['HORA_INICIO'] ?? ''),
          hora_fin: normalizeTime(row['hora_fin'] ?? row['Hora Fin'] ?? row['HORA_FIN'] ?? ''),
          titulo: String(row['titulo'] ?? row['Título'] ?? row['TITULO'] ?? row['titulo'] ?? ''),
          tipo_actividad: String(row['tipo_actividad'] ?? row['Tipo Actividad'] ?? row['TIPO_ACTIVIDAD'] ?? ''),
          sala: String(row['sala'] ?? row['Sala'] ?? row['SALA'] ?? ''),
          ponente: String(row['ponente'] ?? row['Ponente'] ?? row['PONENTE'] ?? ''),
          origen_ponente: String(row['origen_ponente'] ?? row['Origen Ponente'] ?? row['ORIGEN_PONENTE'] ?? ''),
          descripcion: String(row['descripcion'] ?? row['Descripción'] ?? row['DESCRIPCION'] ?? ''),
          tiene_certificado: String(row['tiene_certificado'] ?? row['Tiene Certificado'] ?? row['TIENE_CERTIFICADO'] ?? ''),
          capacidad_maxima: String(row['capacidad_maxima'] ?? row['Capacidad Máxima'] ?? row['CAPACIDAD_MAXIMA'] ?? ''),
        }));

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
}

export function validateImportRows(rows: ImportRow[]): ValidatedImportRow[] {
  return rows.map((row) => {
    const errors: string[] = [];

    if (!row.titulo?.trim()) errors.push('Título requerido');
    if (!row.hora_inicio?.trim()) errors.push('Hora inicio requerida');
    if (!row.hora_fin?.trim()) errors.push('Hora fin requerida');
    if (!row.fecha?.trim() && !row.dia) errors.push('Día o fecha requerido');

    if (row.hora_inicio && !TIME_RE.test(row.hora_inicio)) errors.push('Hora inicio inválida (HH:MM)');
    if (row.hora_fin && !TIME_RE.test(row.hora_fin)) errors.push('Hora fin inválida (HH:MM)');

    const typeKey = row.tipo_actividad?.trim().toLowerCase() ?? '';
    const activityType = TYPE_REVERSE[typeKey];
    if (row.tipo_actividad?.trim() && !activityType) {
      errors.push(`Tipo "${row.tipo_actividad}" inválido. Usar: ${VALID_TYPES_DISPLAY.join(', ')}`);
    }

    return {
      ...row,
      valid: errors.length === 0,
      errors,
      activityType: activityType ?? 'talk',
    };
  });
}

export function downloadErrorReport(rows: ValidatedImportRow[]): void {
  const errorRows = rows.filter((r) => !r.valid);
  const wb = XLSX.utils.book_new();

  const headers = [...COLUMNS, 'errores'];
  const data = errorRows.map((r) => [
    r.dia, r.fecha, r.hora_inicio, r.hora_fin, r.titulo,
    r.tipo_actividad, r.sala, r.ponente, r.origen_ponente,
    r.descripcion, r.tiene_certificado, r.capacidad_maxima,
    r.errors.join('; '),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  XLSX.utils.book_append_sheet(wb, ws, 'Errores');
  XLSX.writeFile(wb, 'errores-importacion-agenda.xlsx');
}
