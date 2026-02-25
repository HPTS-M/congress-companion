import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { useAdminReports } from '@/hooks/useAdminReports';
import { writeExcelFile } from '@/lib/excel';
import ExcelJS from 'exceljs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Calendar, Star, Ticket, Download, FileSpreadsheet, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AttendanceReport, RatingsReport, LogisticsReport, SponsorEngagementReport } from '@/services/admin-reports.service';

function StatCard({ icon: Icon, label, value, loading }: { icon: React.ElementType; label: string; value: string | number; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold">{value}</p>}
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
  writeExcelFile({
    filename: 'reporte_calificaciones.xlsx',
    sheetName: t('reports.ratings.title'),
    columns: [
      { header: t('reports.ratings.colSession'), key: 'title', width: 40 },
      { header: t('reports.ratings.colSpeaker'), key: 'speaker_name', width: 25 },
      { header: t('reports.ratings.colAvg'), key: 'avg_stars', width: 12 },
      { header: t('reports.ratings.colTotal'), key: 'total_ratings', width: 16 },
      { header: t('reports.ratings.colComments'), key: 'comments_text', width: 50 },
    ],
    rows: toRows(data.map((r) => ({ ...r, comments_text: r.comments.join(' | ') }))),
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
    { header: t('reports.ratings.colComments'), key: 'comments_text', width: 50 },
  ];
  ratings.forEach((r) => ws2.addRow({ ...r, comments_text: r.comments.join(' | ') }));

  const ws3 = workbook.addWorksheet(t('reports.logistics.title'));
  ws3.columns = [
    { header: t('reports.logistics.colService'), key: 'name', width: 30 },
    { header: t('reports.logistics.colCategory'), key: 'service_type', width: 15 },
    { header: t('reports.logistics.colDay'), key: 'valid_day', width: 8 },
    { header: t('reports.logistics.colTotal'), key: 'total', width: 12 },
    { header: t('reports.logistics.colUsed'), key: 'used', width: 12 },
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

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reporte_completo.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── FIX 1: Attendance card with table + mini bars ─── */
function AttendanceCard({ data, loading, t }: { data: AttendanceReport[] | undefined; loading: boolean; t: (k: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const TOP_N = 5;

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t('reports.noData')}</p>;
  }

  const maxCheckins = Math.max(...data.map((d) => d.total_checkins), 1);
  const visible = expanded ? data : data.slice(0, TOP_N);
  const hasMore = data.length > TOP_N;

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {visible.map((row) => {
          const pct = (row.total_checkins / maxCheckins) * 100;
          // Extract day number from scheduled_date
          const dayLabel = row.scheduled_date ? `Día ${new Date(row.scheduled_date + 'T00:00:00').getDate()}` : '';
          return (
            <div key={row.session_id} className="flex items-center gap-3 rounded-lg border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" title={row.title}>
                  {row.title.length > 30 ? row.title.slice(0, 30) + '…' : row.title}
                </p>
                <div className="flex gap-1.5 mt-1">
                  {dayLabel && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {dayLabel}
                    </Badge>
                  )}
                  {row.location && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {row.location}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-24 h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: 'hsl(var(--primary))' }}
                  />
                </div>
                <span className="text-sm font-bold w-8 text-right">{row.total_checkins}</span>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? (
            <><ChevronUp className="mr-1 h-3 w-3" /> {t('reports.attendance.showLess')}</>
          ) : (
            <><ChevronDown className="mr-1 h-3 w-3" /> {t('reports.attendance.showAll')}</>
          )}
        </Button>
      )}
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
  const { summary, attendance, ratings, logistics, sponsorEngagement } = useAdminReports(eventId);

  const handleExportAll = async () => {
    if (!attendance.data || !ratings.data || !logistics.data || !sponsorEngagement.data) return;
    try {
      await exportAll(attendance.data, ratings.data, logistics.data, sponsorEngagement.data, t);
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

      {/* Summary Stats — FIX 4: "Sin datos" instead of "—" */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label={t('reports.statAttendees')} value={summary.data?.totalAttendees ?? 0} loading={summary.isLoading} />
        <StatCard icon={Calendar} label={t('reports.statSessions')} value={summary.data?.totalSessions ?? 0} loading={summary.isLoading} />
        <StatCard
          icon={Star}
          label={t('reports.statAvgRating')}
          value={summary.data?.avgRating ? `⭐ ${summary.data.avgRating}` : t('reports.noRatingData')}
          loading={summary.isLoading}
        />
        <StatCard icon={Ticket} label={t('reports.statUsedTickets')} value={summary.data?.usedTickets ?? 0} loading={summary.isLoading} />
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
            <AttendanceCard data={attendance.data} loading={attendance.isLoading} t={t} />
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
              <div className="max-h-64 overflow-y-auto space-y-2">
                {ratings.data!.map((r) => (
                  <div key={r.session_id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      {r.speaker_name && <p className="text-xs text-muted-foreground">{r.speaker_name}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold">⭐ {r.avg_stars}</p>
                      <p className="text-xs text-muted-foreground">({r.total_ratings} {t('reports.ratings.reviews')})</p>
                    </div>
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
                      <TableHead className="text-center">{t('reports.logistics.colPending')}</TableHead>
                      <TableHead className="w-36">{t('reports.logistics.colProgress')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logistics.data!.map((s) => (
                      <TableRow key={s.service_id}>
                        <TableCell className="font-medium text-sm">{s.name}</TableCell>
                        <TableCell className="text-center">{s.total}</TableCell>
                        <TableCell className="text-center">{s.used}</TableCell>
                        <TableCell className="text-center">{s.pending}</TableCell>
                        <TableCell>
                          <LogisticsProgressBar used={s.used} total={s.total} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
    </div>
  );
}
