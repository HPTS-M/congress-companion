import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { useAdminReports } from '@/hooks/useAdminReports';
import { writeExcelFile } from '@/lib/excel';
import ExcelJS from 'exceljs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Calendar, Star, Ticket, Download, FileSpreadsheet, Eye, ClipboardCheck, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { toast } from '@/hooks/use-toast';
import type { AttendanceReport, RatingsReport, LogisticsReport, SponsorEngagementReport, PollResponseReport } from '@/services/admin-reports.service';
import { usePagination } from '@/hooks/usePagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

function StatCard({ icon: Icon, label, value, loading, hint }: { icon: React.ElementType; label: string; value: string | number; loading?: boolean; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold">{value}</p>}
          {hint && !loading && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRows = (data: Record<string, unknown>[] | object[]): Record<string, unknown>[] =>
  data.map((d) => ({ ...d } as Record<string, unknown>));

function exportAttendanceExcel(data: AttendanceReport[], t: (k: string) => string) {
  writeExcelFile({
    filename: 'reporte_asistencia.xlsx',
    sheetName: t('reports.attendance.title'),
    columns: [
      { header: t('reports.attendance.colSession'), key: 'title', width: 40 },
      { header: t('reports.attendance.colRoom'), key: 'location', width: 15 },
      { header: t('reports.attendance.colDay'), key: 'scheduled_date', width: 12 },
      { header: t('reports.attendance.colTime'), key: 'start_time', width: 10 },
      { header: t('reports.attendance.colCheckins'), key: 'total_checkins', width: 14 },
      { header: t('reports.attendance.colInterested'), key: 'total_interested', width: 14 },
    ],
    rows: toRows(data),
  });
}

function exportRatingsExcel(data: RatingsReport[], t: (k: string) => string) {
  // One row per comment so Author + Credential are first-class
  const rows: Record<string, unknown>[] = [];
  data.forEach((r) => {
    if (r.comments.length === 0) {
      rows.push({
        title: r.title,
        speaker_name: r.speaker_name ?? '',
        avg_stars: r.avg_stars,
        total_ratings: r.total_ratings,
        author_name: '',
        credential_code: '',
        stars: '',
        comment: '',
      });
    } else {
      r.comments.forEach((c) => {
        rows.push({
          title: r.title,
          speaker_name: r.speaker_name ?? '',
          avg_stars: r.avg_stars,
          total_ratings: r.total_ratings,
          author_name: c.author_name,
          credential_code: c.credential_code,
          stars: c.stars,
          comment: c.comment,
        });
      });
    }
  });

  writeExcelFile({
    filename: 'reporte_calificaciones.xlsx',
    sheetName: t('reports.ratings.title'),
    columns: [
      { header: t('reports.ratings.colSession'), key: 'title', width: 40 },
      { header: t('reports.ratings.colSpeaker'), key: 'speaker_name', width: 25 },
      { header: t('reports.ratings.colAvg'), key: 'avg_stars', width: 12 },
      { header: t('reports.ratings.colTotal'), key: 'total_ratings', width: 16 },
      { header: t('reports.ratings.colAuthor'), key: 'author_name', width: 28 },
      { header: t('reports.ratings.colCredential'), key: 'credential_code', width: 18 },
      { header: t('reports.ratings.colStars'), key: 'stars', width: 8 },
      { header: t('reports.ratings.colComments'), key: 'comment', width: 60 },
    ],
    rows,
  });
}

function exportPollsExcel(data: PollResponseReport[], t: (k: string) => string) {
  writeExcelFile({
    filename: 'reporte_encuestas.xlsx',
    sheetName: t('reports.polls.title'),
    columns: [
      { header: t('reports.polls.colQuestion'), key: 'question', width: 50 },
      { header: t('reports.polls.colAuthor'), key: 'author_name', width: 28 },
      { header: t('reports.polls.colCredential'), key: 'credential_code', width: 18 },
      { header: t('reports.polls.colAnswer'), key: 'answer', width: 40 },
      { header: t('reports.polls.colDate'), key: 'created_at', width: 22 },
    ],
    rows: data.map((r) => ({
      question: r.question,
      author_name: r.author_name,
      credential_code: r.credential_code,
      answer: r.option_text ?? r.text_response ?? '',
      created_at: r.created_at ? new Date(r.created_at).toLocaleString('es-CO') : '',
    })),
  });
}

function exportLogisticsExcel(data: LogisticsReport[], t: (k: string) => string) {
  writeExcelFile({
    filename: 'reporte_logistica.xlsx',
    sheetName: t('reports.logistics.title'),
    columns: [
      { header: t('reports.logistics.colService'), key: 'name', width: 30 },
      { header: t('reports.logistics.colCategory'), key: 'service_type', width: 15 },
      { header: t('reports.logistics.colDay'), key: 'valid_day', width: 8 },
      { header: t('reports.logistics.colTotal'), key: 'total', width: 12 },
      { header: t('reports.logistics.colUsed'), key: 'used', width: 12 },
      { header: t('reports.logistics.colUsedQr'), key: 'used_qr', width: 14 },
      { header: t('reports.logistics.colUsedManual'), key: 'used_manual', width: 16 },
      { header: t('reports.logistics.colPending'), key: 'pending', width: 12 },
      { header: t('reports.logistics.colCancelled'), key: 'cancelled', width: 12 },
    ],
    rows: toRows(data),
  });
}

function exportSponsorsExcel(data: SponsorEngagementReport[], t: (k: string) => string) {
  writeExcelFile({
    filename: 'reporte_patrocinadores.xlsx',
    sheetName: t('reports.sponsors.title'),
    columns: [
      { header: t('reports.sponsors.colSponsor'), key: 'name', width: 30 },
      { header: t('reports.sponsors.colLevel'), key: 'level', width: 12 },
      { header: t('reports.sponsors.colViews'), key: 'profile_views', width: 14 },
      { header: t('reports.sponsors.colWhatsapp'), key: 'whatsapp_clicks', width: 16 },
      { header: t('reports.sponsors.colLeads'), key: 'leads_captured', width: 16 },
    ],
    rows: toRows(data),
  });
}

async function exportAll(
  attendance: AttendanceReport[],
  ratings: RatingsReport[],
  logistics: LogisticsReport[],
  sponsors: SponsorEngagementReport[],
  pollResponses: PollResponseReport[],
  t: (k: string) => string,
) {
  const workbook = new ExcelJS.Workbook();

  const ws1 = workbook.addWorksheet(t('reports.attendance.title'));
  ws1.columns = [
    { header: t('reports.attendance.colSession'), key: 'title', width: 40 },
    { header: t('reports.attendance.colRoom'), key: 'location', width: 15 },
    { header: t('reports.attendance.colDay'), key: 'scheduled_date', width: 12 },
    { header: t('reports.attendance.colTime'), key: 'start_time', width: 10 },
    { header: t('reports.attendance.colCheckins'), key: 'total_checkins', width: 14 },
    { header: t('reports.attendance.colInterested'), key: 'total_interested', width: 14 },
  ];
  attendance.forEach((r) => ws1.addRow(r));

  const ws2 = workbook.addWorksheet(t('reports.ratings.title'));
  ws2.columns = [
    { header: t('reports.ratings.colSession'), key: 'title', width: 40 },
    { header: t('reports.ratings.colSpeaker'), key: 'speaker_name', width: 25 },
    { header: t('reports.ratings.colAvg'), key: 'avg_stars', width: 12 },
    { header: t('reports.ratings.colTotal'), key: 'total_ratings', width: 16 },
    { header: t('reports.ratings.colAuthor'), key: 'author_name', width: 28 },
    { header: t('reports.ratings.colCredential'), key: 'credential_code', width: 18 },
    { header: t('reports.ratings.colStars'), key: 'stars', width: 8 },
    { header: t('reports.ratings.colComments'), key: 'comment', width: 60 },
  ];
  ratings.forEach((r) => {
    if (r.comments.length === 0) {
      ws2.addRow({ title: r.title, speaker_name: r.speaker_name ?? '', avg_stars: r.avg_stars, total_ratings: r.total_ratings });
    } else {
      r.comments.forEach((c) => {
        ws2.addRow({
          title: r.title,
          speaker_name: r.speaker_name ?? '',
          avg_stars: r.avg_stars,
          total_ratings: r.total_ratings,
          author_name: c.author_name,
          credential_code: c.credential_code,
          stars: c.stars,
          comment: c.comment,
        });
      });
    }
  });

  const ws3 = workbook.addWorksheet(t('reports.logistics.title'));
  ws3.columns = [
    { header: t('reports.logistics.colService'), key: 'name', width: 30 },
    { header: t('reports.logistics.colCategory'), key: 'service_type', width: 15 },
    { header: t('reports.logistics.colDay'), key: 'valid_day', width: 8 },
    { header: t('reports.logistics.colTotal'), key: 'total', width: 12 },
    { header: t('reports.logistics.colUsed'), key: 'used', width: 12 },
    { header: t('reports.logistics.colUsedQr'), key: 'used_qr', width: 14 },
    { header: t('reports.logistics.colUsedManual'), key: 'used_manual', width: 16 },
    { header: t('reports.logistics.colPending'), key: 'pending', width: 12 },
    { header: t('reports.logistics.colCancelled'), key: 'cancelled', width: 12 },
  ];
  logistics.forEach((r) => ws3.addRow(r));

  const ws4 = workbook.addWorksheet(t('reports.sponsors.title'));
  ws4.columns = [
    { header: t('reports.sponsors.colSponsor'), key: 'name', width: 30 },
    { header: t('reports.sponsors.colLevel'), key: 'level', width: 12 },
    { header: t('reports.sponsors.colViews'), key: 'profile_views', width: 14 },
    { header: t('reports.sponsors.colWhatsapp'), key: 'whatsapp_clicks', width: 16 },
    { header: t('reports.sponsors.colLeads'), key: 'leads_captured', width: 16 },
  ];
  sponsors.forEach((r) => ws4.addRow(r));

  const ws5 = workbook.addWorksheet(t('reports.polls.title'));
  ws5.columns = [
    { header: t('reports.polls.colQuestion'), key: 'question', width: 50 },
    { header: t('reports.polls.colAuthor'), key: 'author_name', width: 28 },
    { header: t('reports.polls.colCredential'), key: 'credential_code', width: 18 },
    { header: t('reports.polls.colAnswer'), key: 'answer', width: 40 },
    { header: t('reports.polls.colDate'), key: 'created_at', width: 22 },
  ];
  pollResponses.forEach((r) => {
    ws5.addRow({
      question: r.question,
      author_name: r.author_name,
      credential_code: r.credential_code,
      answer: r.option_text ?? r.text_response ?? '',
      created_at: r.created_at ? new Date(r.created_at).toLocaleString('es-CO') : '',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reporte_completo.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Attendance card with horizontal bar chart ─── */
function AttendanceCard({ data, totalSessions, loading, t }: { data: AttendanceReport[] | undefined; totalSessions: number; loading: boolean; t: (k: string, opts?: Record<string, unknown>) => string }) {
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((d) => d.total_checkins > 0).sort((a, b) => b.total_checkins - a.total_checkins).slice(0, 10);
  }, [data]);

  if (loading) return <Skeleton className="h-48 w-full" />;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <ClipboardCheck className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{t('reports.attendance.emptyTitle')}</p>
      </div>
    );
  }

  const chartData = filtered.map((d) => ({
    ...d,
    label: d.title.length > 25 ? d.title.slice(0, 25) + '…' : d.title,
  }));

  const maxVal = Math.max(...chartData.map((d) => d.total_checkins));
  const chartHeight = Math.max(120, chartData.length * 60);

  return (
    <div className="space-y-3">
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
            <XAxis
              type="number"
              domain={[0, maxVal + 1]}
              allowDecimals={false}
              tickCount={Math.min(maxVal + 1, 6)}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [value, t('reports.attendance.colCheckins')]}
              labelFormatter={(label: string) => label}
            />
            <Bar dataKey="total_checkins" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="#1A56A0" />
              ))}
              <LabelList dataKey="total_checkins" position="right" style={{ fontSize: 12, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {t('reports.attendance.summary', { shown: filtered.length, total: totalSessions })}
      </p>
    </div>
  );
}

/* ─── FIX 2: Ratings empty state ─── */
function RatingsEmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Star className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{t('reports.ratings.emptyTitle')}</p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">{t('reports.ratings.emptyDescription')}</p>
    </div>
  );
}

/* ─── FIX 3: Sponsors empty state ─── */
function SponsorsEmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Eye className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{t('reports.sponsors.emptyTitle')}</p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">{t('reports.sponsors.emptyDescription')}</p>
    </div>
  );
}

/* ─── FIX 5: Progress bar with color coding ─── */
function LogisticsProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  let barColor: string;
  if (pct === 0) barColor = 'hsl(var(--muted-foreground) / 0.3)';
  else if (pct <= 50) barColor = '#F59E0B';
  else if (pct < 100) barColor = 'hsl(var(--primary))';
  else barColor = '#10B981';

  return (
    <div className="flex items-center gap-2">
      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

export default function Reports() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const eventId = event?.id;
  const { summary, attendance, ratings, logistics, sponsorEngagement, pollResponses } = useAdminReports(eventId);

  const logisticsPagination = usePagination(logistics.data ?? [], 10);
  const sponsorsPagination = usePagination(sponsorEngagement.data ?? [], 10);

  // Polls filter + pagination
  const [pollFilter, setPollFilter] = useState<string>('all');
  const filteredPollResponses = useMemo(() => {
    const all = pollResponses.data ?? [];
    return pollFilter === 'all' ? all : all.filter((r) => r.poll_id === pollFilter);
  }, [pollResponses.data, pollFilter]);
  const pollsPagination = usePagination(filteredPollResponses, 10);

  const uniquePolls = useMemo(() => {
    const map = new Map<string, string>();
    (pollResponses.data ?? []).forEach((r) => map.set(r.poll_id, r.question));
    return Array.from(map, ([id, question]) => ({ id, question }));
  }, [pollResponses.data]);

  const handleExportAll = async () => {
    if (!attendance.data || !ratings.data || !logistics.data || !sponsorEngagement.data) return;
    try {
      await exportAll(
        attendance.data,
        ratings.data,
        logistics.data,
        sponsorEngagement.data,
        pollResponses.data ?? [],
        t,
      );
      toast({ title: t('reports.exportSuccess') });
    } catch {
      toast({ title: t('reports.exportError'), variant: 'destructive' });
    }
  };

  // FIX 3: Check if all sponsor engagement values are 0
  const allSponsorsZero = sponsorEngagement.data?.every(
    (s) => s.profile_views === 0 && s.whatsapp_clicks === 0 && s.leads_captured === 0
  ) ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={handleExportAll} disabled={!attendance.data}>
          <Download className="mr-2 h-4 w-4" />
          {t('reports.exportAll')}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label={t('reports.statAttendees')} value={summary.data?.totalAttendees ?? 0} loading={summary.isLoading} />
        <StatCard icon={Calendar} label={t('reports.statSessions')} value={summary.data?.totalSessions ?? 0} loading={summary.isLoading} />
        <StatCard
          icon={Star}
          label={t('reports.statAvgRating')}
          value={summary.data?.avgRating ? `⭐ ${summary.data.avgRating}` : t('reports.noRatingData')}
          loading={summary.isLoading}
        />
        <StatCard
          icon={Ticket}
          label={t('reports.statUsedTickets')}
          value={summary.data?.usedTickets ?? 0}
          loading={summary.isLoading}
          hint={
            summary.data && summary.data.usedTickets > 0
              ? t('reports.statUsedTicketsBreakdown', {
                  qr: summary.data.usedTicketsQr ?? 0,
                  manual: summary.data.usedTicketsManual ?? 0,
                })
              : undefined
          }
        />
      </div>

      {/* 2x2 Report Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CARD 1 — Attendance (FIX 1) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t('reports.attendance.title')}</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => attendance.data && exportAttendanceExcel(attendance.data, t)}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </CardHeader>
          <CardContent>
            <AttendanceCard data={attendance.data} totalSessions={summary.data?.totalSessions ?? 0} loading={attendance.isLoading} t={t} />
          </CardContent>
        </Card>

        {/* CARD 2 — Ratings (FIX 2) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t('reports.ratings.title')}</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => ratings.data && exportRatingsExcel(ratings.data, t)}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </CardHeader>
          <CardContent>
            {ratings.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (ratings.data?.length ?? 0) === 0 ? (
              <RatingsEmptyState t={t} />
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2">
                {ratings.data!.map((r) => (
                  <div key={r.session_id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        {r.speaker_name && <p className="text-xs text-muted-foreground">{r.speaker_name}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-semibold">⭐ {r.avg_stars}</p>
                        <p className="text-xs text-muted-foreground">({r.total_ratings} {t('reports.ratings.reviews')})</p>
                      </div>
                    </div>
                    {r.comments.length > 0 && (
                      <ul className="space-y-1.5 border-t pt-2">
                        {r.comments.map((c, i) => (
                          <li key={i} className="text-xs space-y-0.5">
                            <div className="flex items-center justify-between gap-2 text-muted-foreground">
                              <span className="font-medium text-foreground truncate">{c.author_name}</span>
                              <span className="shrink-0">⭐ {c.stars}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{c.credential_code}</p>
                            <p className="whitespace-pre-wrap">{c.comment}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CARD 3 — Logistics (FIX 5: color-coded progress) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t('reports.logistics.title')}</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => logistics.data && exportLogisticsExcel(logistics.data, t)}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </CardHeader>
          <CardContent>
            {logistics.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (logistics.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('reports.noData')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.logistics.colService')}</TableHead>
                      <TableHead className="text-center">{t('reports.logistics.colTotal')}</TableHead>
                      <TableHead className="text-center">{t('reports.logistics.colUsed')}</TableHead>
                      <TableHead className="text-center hidden md:table-cell">{t('reports.logistics.colUsedQr')}</TableHead>
                      <TableHead className="text-center hidden md:table-cell">{t('reports.logistics.colUsedManual')}</TableHead>
                      <TableHead className="text-center">{t('reports.logistics.colPending')}</TableHead>
                      <TableHead className="w-36">{t('reports.logistics.colProgress')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logisticsPagination.paginatedItems.map((s) => (
                      <TableRow key={s.service_id}>
                        <TableCell className="font-medium text-sm">{s.name}</TableCell>
                        <TableCell className="text-center">{s.total}</TableCell>
                        <TableCell className="text-center">{s.used}</TableCell>
                        <TableCell className="text-center hidden md:table-cell text-xs text-muted-foreground">{s.used_qr}</TableCell>
                        <TableCell className="text-center hidden md:table-cell text-xs text-muted-foreground">{s.used_manual}</TableCell>
                        <TableCell className="text-center">{s.pending}</TableCell>
                        <TableCell>
                          <LogisticsProgressBar used={s.used} total={s.total} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={logisticsPagination.currentPage}
                  totalPages={logisticsPagination.totalPages}
                  totalItems={logisticsPagination.totalItems}
                  startIndex={logisticsPagination.startIndex}
                  endIndex={logisticsPagination.endIndex}
                  onPageChange={logisticsPagination.setPage}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* CARD 4 — Sponsors (FIX 3: empty state when all zeros) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t('reports.sponsors.title')}</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => sponsorEngagement.data && exportSponsorsExcel(sponsorEngagement.data, t)}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </CardHeader>
          <CardContent>
            {sponsorEngagement.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (sponsorEngagement.data?.length ?? 0) === 0 || allSponsorsZero ? (
              <SponsorsEmptyState t={t} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.sponsors.colSponsor')}</TableHead>
                      <TableHead className="text-center">{t('reports.sponsors.colViews')}</TableHead>
                      <TableHead className="text-center">{t('reports.sponsors.colWhatsapp')}</TableHead>
                      <TableHead className="text-center">{t('reports.sponsors.colLeads')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sponsorEngagement.data!.map((s) => (
                      <TableRow key={s.sponsor_id}>
                        <TableCell>
                          <span className="font-medium text-sm">{s.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground capitalize">{s.level}</span>
                        </TableCell>
                        <TableCell className="text-center">{s.profile_views}</TableCell>
                        <TableCell className="text-center">{s.whatsapp_clicks}</TableCell>
                        <TableCell className="text-center">{s.leads_captured}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Polls Responses Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">{t('reports.polls.title')}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {uniquePolls.length > 0 && (
              <Select value={pollFilter} onValueChange={(v) => { setPollFilter(v); pollsPagination.setPage(1); }}>
                <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.polls.filterAll')}</SelectItem>
                  {uniquePolls.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.question.length > 50 ? p.question.slice(0, 50) + '…' : p.question}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="ghost" onClick={() => pollResponses.data && exportPollsExcel(pollResponses.data, t)} disabled={!pollResponses.data?.length}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pollResponses.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredPollResponses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{t('reports.polls.emptyTitle')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.polls.colQuestion')}</TableHead>
                    <TableHead>{t('reports.polls.colAuthor')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('reports.polls.colCredential')}</TableHead>
                    <TableHead>{t('reports.polls.colAnswer')}</TableHead>
                    <TableHead className="hidden md:table-cell text-right">{t('reports.polls.colDate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pollsPagination.paginatedItems.map((r, i) => (
                    <TableRow key={`${r.poll_id}-${i}`}>
                      <TableCell className="max-w-[260px] text-sm">
                        <span className="line-clamp-2">{r.question}</span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{r.author_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{r.credential_code}</TableCell>
                      <TableCell className="text-sm">{r.option_text ?? r.text_response ?? '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <DataTablePagination
                currentPage={pollsPagination.currentPage}
                totalPages={pollsPagination.totalPages}
                totalItems={pollsPagination.totalItems}
                startIndex={pollsPagination.startIndex}
                endIndex={pollsPagination.endIndex}
                onPageChange={pollsPagination.setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
