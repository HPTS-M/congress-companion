import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, FileText, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useBulkCreateAttendees, useExistingEmails, useSendInvitations } from '@/hooks/useAdminAttendees';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { readExcelFile, writeExcelFile } from '@/lib/excel';

interface AttendeeRow {
  full_name: string;
  email: string;
  specialty?: string;
  institution?: string;
}

type RowStatus = 'valid' | 'warning' | 'error';

interface ValidatedRow extends AttendeeRow {
  status: RowStatus;
  issue?: string;
}

interface ImportResult {
  imported: number;
  warnings: number;
  errors: number;
  errorRows: ValidatedRow[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseExcelRows(raw: Record<string, unknown>[]): AttendeeRow[] {
  return raw.map(r => ({
    full_name: String(r['full_name'] ?? r['nombre'] ?? r['Nombre'] ?? r['full_name'] ?? '').trim(),
    email: String(r['email'] ?? r['correo'] ?? r['Email'] ?? r['Correo'] ?? '').trim(),
    specialty: String(r['specialty'] ?? r['especialidad'] ?? r['Specialty'] ?? r['Especialidad'] ?? '').trim() || undefined,
    institution: String(r['institution'] ?? r['institucion'] ?? r['Institution'] ?? r['Institucion'] ?? r['institución'] ?? r['Institución'] ?? '').trim() || undefined,
  }));
}

async function downloadTemplate() {
  await writeExcelFile({
    filename: 'plantilla-asistentes.xlsx',
    sheetName: 'Asistentes',
    columns: [
      { header: 'full_name', key: 'full_name', width: 30 },
      { header: 'email', key: 'email', width: 30 },
      { header: 'specialty', key: 'specialty', width: 20 },
      { header: 'institution', key: 'institution', width: 25 },
    ],
    rows: [
      { full_name: 'Dr. Juan Pérez', email: 'juan@ejemplo.com', specialty: 'Cardiología', institution: 'Hospital General' },
      { full_name: 'Dra. María López', email: 'maria@ejemplo.com', specialty: 'Neurología', institution: 'Clínica Central' },
    ],
  });
}

async function downloadErrorReport(errorRows: ValidatedRow[]) {
  await writeExcelFile({
    filename: 'errores-importacion.xlsx',
    sheetName: 'Errores',
    columns: [
      { header: 'full_name', key: 'full_name', width: 30 },
      { header: 'email', key: 'email', width: 30 },
      { header: 'specialty', key: 'specialty', width: 20 },
      { header: 'institution', key: 'institution', width: 25 },
      { header: 'status', key: 'status', width: 12 },
      { header: 'issue', key: 'issue', width: 35 },
    ],
    rows: errorRows.map(r => ({
      full_name: r.full_name,
      email: r.email,
      specialty: r.specialty ?? '',
      institution: r.institution ?? '',
      status: r.status,
      issue: r.issue ?? '',
    })),
  });
}

export function ImportCsvModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation('admin');
  const bulkMutation = useBulkCreateAttendees();
  const sendInvitationsMutation = useSendInvitations();
  const { data: existingEmails } = useExistingEmails();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawRows, setRawRows] = useState<AttendeeRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importStatus, setImportStatus] = useState<'confirmed' | 'pending'>('confirmed');

  const existingEmailSet = useMemo(
    () => new Set((existingEmails ?? []).map((e) => e.toLowerCase())),
    [existingEmails],
  );

  const validatedRows: ValidatedRow[] = useMemo(() => {
    if (rawRows.length === 0) return [];
    const emailsSeen = new Map<string, number>();

    return rawRows.map((row) => {
      if (!row.full_name?.trim() || !row.email?.trim()) {
        return { ...row, status: 'error' as const, issue: t('attendees.importModal.missingRequired') };
      }
      if (!EMAIL_REGEX.test(row.email)) {
        return { ...row, status: 'error' as const, issue: t('attendees.importModal.invalidEmail') };
      }

      const emailKey = row.email.toLowerCase();
      const prevIdx = emailsSeen.get(emailKey);
      emailsSeen.set(emailKey, (prevIdx ?? 0) + 1);
      if (prevIdx !== undefined && prevIdx >= 1) {
        return { ...row, status: 'warning' as const, issue: t('attendees.importModal.duplicateEmail') };
      }

      if (existingEmailSet.has(emailKey)) {
        return { ...row, status: 'warning' as const, issue: t('attendees.importModal.duplicateEmailDb') };
      }

      return { ...row, status: 'valid' as const };
    });
  }, [rawRows, existingEmailSet, t]);

  const validCount = validatedRows.filter((r) => r.status !== 'error').length;
  const warningCount = validatedRows.filter((r) => r.status === 'warning').length;
  const errorCount = validatedRows.filter((r) => r.status === 'error').length;

  const handleFile = useCallback(async (file: File) => {
    const validExts = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      toast({ title: t('attendees.importModal.invalidFormat'), variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    setImportResult(null);

    try {
      const raw = await readExcelFile<Record<string, unknown>>(file);
      const parsed = parseExcelRows(raw);
      if (parsed.length === 0) {
        toast({ title: t('attendees.importModal.emptyFile'), variant: 'destructive' });
        return;
      }
      setRawRows(parsed);
    } catch {
      toast({ title: t('attendees.importModal.invalidFormat'), variant: 'destructive' });
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    const rowsToImport = validatedRows.filter((r) => r.status !== 'error');
    if (rowsToImport.length === 0) return;

    try {
      setProgress(10);
      const result = await bulkMutation.mutateAsync({ rows: rowsToImport, registrationStatus: importStatus });
      setProgress(80);

      if (importStatus === 'confirmed' && result.ids.length > 0) {
        try {
          await sendInvitationsMutation.mutateAsync(result.ids);
        } catch (invErr) {
          console.error('Failed to send invitations:', invErr);
        }
      }
      setProgress(100);

      const errorRows = validatedRows.filter((r) => r.status === 'error');
      setImportResult({
        imported: result.inserted,
        warnings: warningCount,
        errors: errorCount,
        errorRows,
      });

      toast({ title: t('attendees.importModal.success', { count: result.inserted }) });
    } catch {
      toast({ title: t('attendees.newAttendeeModal.error'), variant: 'destructive' });
      setProgress(0);
    }
  };

  const reset = () => {
    setRawRows([]);
    setFileName('');
    setProgress(0);
    setImportResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t('attendees.importModal.title')}</DialogTitle>
        </DialogHeader>

        <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-fit">
          <Download className="mr-2 h-4 w-4" />
          {t('attendees.importModal.downloadTemplate')}
        </Button>

        {importResult ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-accent">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('attendees.importModal.summaryImported', { count: importResult.imported })}
                </div>
                {importResult.warnings > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    {t('attendees.importModal.summaryWarnings', { count: importResult.warnings })}
                  </div>
                )}
                {importResult.errors > 0 && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {t('attendees.importModal.summaryErrors', { count: importResult.errors })}
                  </div>
                )}
              </CardContent>
            </Card>
            {importResult.errorRows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadErrorReport(importResult.errorRows)}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('attendees.importModal.downloadErrors')}
              </Button>
            )}
            <Button className="w-full" onClick={() => { reset(); onOpenChange(false); }}>
              OK
            </Button>
          </div>
        ) : rawRows.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {t('attendees.importModal.dragDropExcel')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{t('attendees.importModal.selectedFile')}: <strong>{fileName}</strong></span>
            </div>

            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-accent">
                <CheckCircle2 className="h-3 w-3" /> {validCount - warningCount} {t('attendees.importModal.validRow')}
              </span>
              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> {warningCount} {t('attendees.importModal.warningRow')}
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" /> {errorCount} {t('attendees.importModal.errorRow')}
                </span>
              )}
            </div>

            <div className="text-sm font-medium text-foreground">{t('attendees.importModal.previewTitle')}</div>
            <div className="max-h-48 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>{t('attendees.importModal.columnStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedRows.slice(0, 20).map((r, i) => (
                    <TableRow
                      key={i}
                      className={cn(
                        r.status === 'valid' && 'bg-accent/5',
                        r.status === 'warning' && 'bg-amber-500/10',
                        r.status === 'error' && 'bg-destructive/10',
                      )}
                    >
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm">{r.full_name || '—'}</TableCell>
                      <TableCell className="text-sm">{r.email || '—'}</TableCell>
                      <TableCell>
                        {r.status === 'valid' && (
                          <span className="text-xs text-accent">{t('attendees.importModal.validRow')}</span>
                        )}
                        {r.status === 'warning' && (
                          <span className="text-xs text-amber-600" title={r.issue}>{r.issue}</span>
                        )}
                        {r.status === 'error' && (
                          <span className="text-xs text-destructive" title={r.issue}>{r.issue}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {validatedRows.length > 20 && (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                  +{validatedRows.length - 20} más...
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('attendees.importStatusLabel')}</Label>
              <Select value={importStatus} onValueChange={(v) => setImportStatus(v as 'confirmed' | 'pending')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">{t('attendees.importStatusConfirmed')}</SelectItem>
                  <SelectItem value="pending">{t('attendees.importStatusPending')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {importStatus === 'confirmed'
                  ? t('attendees.confirmedHint')
                  : t('attendees.pendingHint')}
              </p>
            </div>

            {progress > 0 && <Progress value={progress} className="h-2" />}

            <Button
              className="w-full"
              onClick={handleImport}
              disabled={bulkMutation.isPending || sendInvitationsMutation.isPending || validCount === 0}
            >
              {bulkMutation.isPending || sendInvitationsMutation.isPending
                ? t('attendees.importModal.importing')
                : errorCount > 0
                  ? t('attendees.importModal.importValidOnly', { count: validCount })
                  : t('attendees.importModal.importButton', { count: validatedRows.length })}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
