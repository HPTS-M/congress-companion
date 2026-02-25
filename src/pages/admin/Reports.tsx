import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { useAdminReports } from '@/hooks/useAdminReports';
import { writeExcelFile, writeExcelAoa } from '@/lib/excel';
import ExcelJS from 'exceljs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Calendar, Star, Ticket, Download, FileSpreadsheet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

  // Sheet 1 — Attendance
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

  // Sheet 2 — Ratings
  const ws2 = workbook.addWorksheet(t('reports.ratings.title'));
  ws2.columns = [
    { header: t('reports.ratings.colSession'), key: 'title', width: 40 },
    { header: t('reports.ratings.colSpeaker'), key: 'speaker_name', width: 25 },
    { header: t('reports.ratings.colAvg'), key: 'avg_stars', width: 12 },
    { header: t('reports.ratings.colTotal'), key: 'total_ratings', width: 16 },
    { header: t('reports.ratings.colComments'), key: 'comments_text', width: 50 },
  ];
  ratings.forEach((r) => ws2.addRow({ ...r, comments_text: r.comments.join(' | ') }));

  // Sheet 3 — Logistics
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

  // Sheet 4 — Sponsors
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
        <StatCard icon={Star} label={t('reports.statAvgRating')} value={summary.data?.avgRating ? `⭐ ${summary.data.avgRating}` : '—'} loading={summary.isLoading} />
        <StatCard icon={Ticket} label={t('reports.statUsedTickets')} value={summary.data?.usedTickets ?? 0} loading={summary.isLoading} />
      </div>

      {/* 2x2 Report Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CARD 1 — Attendance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t('reports.attendance.title')}</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => attendance.data && exportAttendanceExcel(attendance.data, t)}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </CardHeader>
          <CardContent>
            {attendance.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (attendance.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('reports.noData')}</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendance.data} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="title" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total_checkins" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CARD 2 — Ratings */}
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
              <p className="text-sm text-muted-foreground py-8 text-center">{t('reports.noData')}</p>
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

        {/* CARD 3 — Logistics */}
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
                      <TableHead className="w-32">{t('reports.logistics.colProgress')}</TableHead>
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
                          <Progress value={s.total > 0 ? (s.used / s.total) * 100 : 0} className="h-2" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CARD 4 — Sponsors */}
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
            ) : (sponsorEngagement.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('reports.noData')}</p>
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
