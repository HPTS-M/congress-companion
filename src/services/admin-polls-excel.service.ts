import { supabase } from '@/integrations/supabase/client';
import { writeExcelFile } from '@/lib/excel';

interface DetailedRow {
  encuesta: string;
  tipo: string;
  sesion: string;
  pregunta: string;
  opcion: string;
  texto: string;
  asistente: string;
  credencial: string;
  email: string;
  fecha: string;
}

interface SummaryRow {
  encuesta: string;
  tipo: string;
  estado: string;
  total_respuestas: number;
  asistentes_unicos: number;
  fecha_creacion: string;
}

interface CountRow {
  encuesta: string;
  opcion: string;
  votos: number;
  porcentaje: string;
}

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Opción múltiple',
  single_choice: 'Opción única',
  rating_scale: 'Calificación 1-5',
  open_text: 'Texto abierto',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activa',
  closed: 'Cerrada',
};

interface PollRow {
  id: string;
  question: string;
  poll_type: string;
  status: string;
  created_at: string | null;
  session_id: string | null;
}

interface OptionRow {
  id: string;
  poll_id: string;
  option_text: string;
  order_index: number;
}

interface ResponseRow {
  poll_id: string;
  attendee_id: string;
  option_id: string | null;
  text_response: string | null;
  created_at: string | null;
}

interface AttendeeRow {
  id: string;
  full_name: string;
  email: string;
  credential_code: string;
}

interface SessionRow {
  id: string;
  title: string;
}

async function fetchAllResponses(pollIds: string[]): Promise<ResponseRow[]> {
  // Batching para evitar límite de 1000 filas de Supabase
  const PAGE = 1000;
  const out: ResponseRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('poll_responses')
      .select('poll_id, attendee_id, option_id, text_response, created_at')
      .in('poll_id', pollIds)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as ResponseRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function buildExportData(eventId: string, pollFilter?: string) {
  const pollsQuery = supabase
    .from('polls')
    .select('id, question, poll_type, status, created_at, session_id')
    .eq('event_id', eventId);

  const { data: rawPolls, error: pErr } = pollFilter
    ? await pollsQuery.eq('id', pollFilter)
    : await pollsQuery;

  if (pErr) throw new Error(pErr.message);
  const polls: PollRow[] = (rawPolls ?? []) as PollRow[];
  const pollIds = polls.map(p => p.id);

  if (pollIds.length === 0) {
    return { polls, options: [], responses: [], attendees: new Map<string, AttendeeRow>(), sessions: new Map<string, SessionRow>() };
  }

  const sessionIds = polls.map(p => p.session_id).filter((x): x is string => !!x);

  const [optsRes, sessRes] = await Promise.all([
    supabase.from('poll_options').select('id, poll_id, option_text, order_index').in('poll_id', pollIds),
    sessionIds.length > 0
      ? supabase.from('event_activities').select('id, title').in('id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (optsRes.error) throw new Error(optsRes.error.message);
  if (sessRes.error) throw new Error(sessRes.error.message);

  const options = (optsRes.data ?? []) as OptionRow[];
  const responses = await fetchAllResponses(pollIds);

  const attendeeIds = Array.from(new Set(responses.map(r => r.attendee_id)));
  let attendees: AttendeeRow[] = [];
  if (attendeeIds.length > 0) {
    const { data: aData, error: aErr } = await supabase
      .from('attendees')
      .select('id, full_name, email, credential_code')
      .in('id', attendeeIds);
    if (aErr) throw new Error(aErr.message);
    attendees = (aData ?? []) as AttendeeRow[];
  }

  return {
    polls,
    options,
    responses,
    attendees: new Map(attendees.map(a => [a.id, a])),
    sessions: new Map((sessRes.data ?? []).map((s: SessionRow) => [s.id, s])),
  };
}

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export const adminPollsExcelService = {
  async exportAllResponses(eventId: string, eventCode: string): Promise<void> {
    const { polls, options, responses, attendees, sessions } = await buildExportData(eventId);

    const optsById = new Map(options.map(o => [o.id, o]));
    const optsByPoll = new Map<string, OptionRow[]>();
    for (const o of options) {
      const list = optsByPoll.get(o.poll_id) ?? [];
      list.push(o);
      optsByPoll.set(o.poll_id, list);
    }

    // Hoja 1: Respuestas detalladas
    const detailed: DetailedRow[] = responses.map(r => {
      const poll = polls.find(p => p.id === r.poll_id);
      const att = attendees.get(r.attendee_id);
      const opt = r.option_id ? optsById.get(r.option_id) : null;
      const sess = poll?.session_id ? sessions.get(poll.session_id) : null;
      return {
        encuesta: poll?.question ?? '',
        tipo: TYPE_LABELS[poll?.poll_type ?? ''] ?? poll?.poll_type ?? '',
        sesion: sess?.title ?? '',
        pregunta: poll?.question ?? '',
        opcion: opt?.option_text ?? '',
        texto: r.text_response ?? '',
        asistente: att?.full_name ?? '(asistente eliminado)',
        credencial: att?.credential_code ?? '',
        email: att?.email ?? '',
        fecha: formatDate(r.created_at),
      };
    });

    // Hoja 2: Resumen por encuesta
    const summary: SummaryRow[] = polls.map(p => {
      const pollResponses = responses.filter(r => r.poll_id === p.id);
      const uniqueAttendees = new Set(pollResponses.map(r => r.attendee_id)).size;
      return {
        encuesta: p.question,
        tipo: TYPE_LABELS[p.poll_type] ?? p.poll_type,
        estado: STATUS_LABELS[p.status] ?? p.status,
        total_respuestas: pollResponses.length,
        asistentes_unicos: uniqueAttendees,
        fecha_creacion: formatDate(p.created_at),
      };
    });

    // Hoja 3: Conteo por opción
    const counts: CountRow[] = [];
    for (const p of polls) {
      const pollOpts = optsByPoll.get(p.id) ?? [];
      const pollResp = responses.filter(r => r.poll_id === p.id && r.option_id);
      const total = pollResp.length;
      for (const opt of pollOpts) {
        const votes = pollResp.filter(r => r.option_id === opt.id).length;
        counts.push({
          encuesta: p.question,
          opcion: opt.option_text,
          votos: votes,
          porcentaje: total > 0 ? `${Math.round((votes / total) * 100)}%` : '0%',
        });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const filename = `Encuestas_${eventCode}_${today}.xlsx`;

    // Escribir las 3 hojas en un mismo archivo
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    const ws1 = wb.addWorksheet('Respuestas detalladas');
    ws1.columns = [
      { header: 'Encuesta', key: 'encuesta', width: 40 },
      { header: 'Tipo', key: 'tipo', width: 18 },
      { header: 'Sesión', key: 'sesion', width: 25 },
      { header: 'Pregunta', key: 'pregunta', width: 40 },
      { header: 'Opción seleccionada', key: 'opcion', width: 25 },
      { header: 'Respuesta texto', key: 'texto', width: 40 },
      { header: 'Asistente', key: 'asistente', width: 28 },
      { header: 'Credencial', key: 'credencial', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Fecha respuesta', key: 'fecha', width: 18 },
    ];
    detailed.forEach(r => ws1.addRow(r));

    const ws2 = wb.addWorksheet('Resumen por encuesta');
    ws2.columns = [
      { header: 'Encuesta', key: 'encuesta', width: 50 },
      { header: 'Tipo', key: 'tipo', width: 18 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Total respuestas', key: 'total_respuestas', width: 18 },
      { header: 'Asistentes únicos', key: 'asistentes_unicos', width: 18 },
      { header: 'Fecha creación', key: 'fecha_creacion', width: 18 },
    ];
    summary.forEach(r => ws2.addRow(r));

    const ws3 = wb.addWorksheet('Conteo por opción');
    ws3.columns = [
      { header: 'Encuesta', key: 'encuesta', width: 50 },
      { header: 'Opción', key: 'opcion', width: 25 },
      { header: 'Votos', key: 'votos', width: 10 },
      { header: '% del total', key: 'porcentaje', width: 12 },
    ];
    counts.forEach(r => ws3.addRow(r));

    [ws1, ws2, ws3].forEach(ws => {
      ws.getRow(1).font = { bold: true };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  async exportSinglePoll(pollId: string, eventId: string, eventCode: string): Promise<void> {
    const { polls, options, responses, attendees } = await buildExportData(eventId, pollId);
    if (polls.length === 0) return;
    const poll = polls[0];

    const optsById = new Map(options.map(o => [o.id, o]));

    const rows = responses.map(r => {
      const att = attendees.get(r.attendee_id);
      const opt = r.option_id ? optsById.get(r.option_id) : null;
      return {
        opcion: opt?.option_text ?? '',
        texto: r.text_response ?? '',
        asistente: att?.full_name ?? '(asistente eliminado)',
        credencial: att?.credential_code ?? '',
        email: att?.email ?? '',
        fecha: formatDate(r.created_at),
      };
    });

    const today = new Date().toISOString().slice(0, 10);
    const safeQ = poll.question.slice(0, 30).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const filename = `Encuesta_${safeQ}_${eventCode}_${today}.xlsx`;

    await writeExcelFile({
      filename,
      sheetName: 'Respuestas',
      columns: [
        { header: 'Opción', key: 'opcion', width: 25 },
        { header: 'Respuesta texto', key: 'texto', width: 50 },
        { header: 'Asistente', key: 'asistente', width: 28 },
        { header: 'Credencial', key: 'credencial', width: 24 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Fecha', key: 'fecha', width: 18 },
      ],
      rows,
    });
  },
};
