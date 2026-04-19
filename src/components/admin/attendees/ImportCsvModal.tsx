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
import {
  useBulkCreateAttendees,
  useExistingEmails,
  useExistingExternalCodes,
  useSendInvitations,
} from '@/hooks/useAdminAttendees';
import { useEvent } from '@/hooks/useEvent';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { readExcelFile, writeExcelFile } from '@/lib/excel';
import {
  normalizeRow,
  validateRow,
  classifyRow,
  applyNoAplica,
  type ValidatedRow,
  type FieldError,
} from '@/lib/import-validators';
import { ImportErrorsModal } from './ImportErrorsModal';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ProcessedRow {
  rowNumber: number;
  validated: ValidatedRow;
  blocked: boolean;
  blockingErrors: FieldError[];
  permissiveErrors: FieldError[];
  duplicateInFile?: boolean;
  duplicateInDb?: boolean;
  duplicateExternalInFile?: boolean;
  duplicateExternalInDb?: boolean;
}

interface ImportResult {
  imported: number;
  blocked: number;
  permissiveFixed: number;
  blockedRows: ProcessedRow[];
}

async function downloadTemplate() {
  await writeExcelFile({
    filename: 'plantilla-asistentes.xlsx',
    sheetName: 'Asistentes',
    columns: [
      { header: 'Nombre completo', key: 'full_name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Código credencial', key: 'external_credential_code', width: 22 },
      { header: 'Especialidad', key: 'specialty', width: 20 },
      { header: 'Institución', key: 'institution', width: 25 },
      { header: 'Estado', key: 'registration_status_id', width: 10 },
    ],
    rows: [
      {
        full_name: 'Dr. Juan Pérez',
        email: 'juan@ejemplo.com',
        external_credential_code: 'EXT-001234',
        specialty: 'Cardiología',
        institution: 'Hospital General',
        registration_status_id: 1,
      },
      {
        full_name: 'Dra. María López',
        email: 'maria@ejemplo.com',
        external_credential_code: 'EXT-001235',
        specialty: 'Neurología',
        institution: 'Clínica Central',
        registration_status_id: 2,
      },
    ],
  });
}

export function ImportCsvModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const externalCredentialsEnabled =
    ((event?.settings ?? {}) as Record<string, unknown>).external_credentials_enabled === true;

  const bulkMutation = useBulkCreateAttendees();
  const sendInvitationsMutation = useSendInvitations();
  const { data: existingEmails } = useExistingEmails();
  const { data: existingExternalCodes } = useExistingExternalCodes();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importStatus, setImportStatus] = useState<'confirmed' | 'pending'>('confirmed');
  const [errorsModalOpen, setErrorsModalOpen] = useState(false);

  const existingEmailSet = useMemo(
    () => new Set((existingEmails ?? []).map((e) => e.toLowerCase())),
    [existingEmails],
  );
  const existingExternalSet = useMemo(
    () => new Set((existingExternalCodes ?? []).map((c) => c.toUpperCase())),
    [existingExternalCodes],
  );

  const processedRows: ProcessedRow[] = useMemo(() => {
    if (rawRows.length === 0) return [];
    const emailsSeen = new Map<string, number>();
    const externalSeen = new Map<string, number>();

    return rawRows.map((raw, idx) => {
      const normalized = normalizeRow(raw);
      const validated = validateRow(normalized, {
        externalCredentialsRequired: externalCredentialsEnabled,
      });
      const classification = classifyRow(validated, {
        externalCredentialsEnabled,
      });

      // Duplicate checks (only when field is present and well-formed)
      let duplicateInFile = false;
      let duplicateInDb = false;
      let duplicateExternalInFile = false;
      let duplicateExternalInDb = false;

      if (validated.email) {
        const k = validated.email.toLowerCase();
        const prev = emailsSeen.get(k);
        emailsSeen.set(k, (prev ?? 0) + 1);
        if (prev !== undefined) duplicateInFile = true;
        if (existingEmailSet.has(k)) duplicateInDb = true;
      }

      if (externalCredentialsEnabled && validated.external_credential_code) {
        const k = validated.external_credential_code.toUpperCase();
        const prev = externalSeen.get(k);
        externalSeen.set(k, (prev ?? 0) + 1);
        if (prev !== undefined) duplicateExternalInFile = true;
        if (existingExternalSet.has(k)) duplicateExternalInDb = true;
      }

      // Duplicates are blocking
      const extraBlocking: FieldError[] = [];
      if (duplicateInFile) extraBlocking.push({ field: 'email', message: 'duplicate_in_file' });
      if (duplicateInDb) extraBlocking.push({ field: 'email', message: 'duplicate_in_db' });
      if (duplicateExternalInFile)
        extraBlocking.push({ field: 'external_credential_code', message: 'duplicate_in_file' });
      if (duplicateExternalInDb)
        extraBlocking.push({ field: 'external_credential_code', message: 'duplicate_in_db' });

      const blockingErrors = [...classification.blockingErrors, ...extraBlocking];
      const blocked = blockingErrors.length > 0;

      return {
        rowNumber: idx + 2, // +2 = header row + 1-based
        validated,
        blocked,
        blockingErrors,
        permissiveErrors: classification.permissiveErrors,
        duplicateInFile,
        duplicateInDb,
        duplicateExternalInFile,
        duplicateExternalInDb,
      };
    });
  }, [rawRows, existingEmailSet, existingExternalSet, externalCredentialsEnabled]);

  const validRows = processedRows.filter((r) => !r.blocked);
  const blockedRows = processedRows.filter((r) => r.blocked);
  const rowsWithPermissiveErrors = validRows.filter((r) => r.permissiveErrors.length > 0);

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
      if (raw.length === 0) {
        toast({ title: t('attendees.importModal.emptyFile'), variant: 'destructive' });
        return;
      }
      setRawRows(raw);
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
    if (validRows.length === 0) return;

    try {
      setProgress(10);

      // Apply NO APLICA substitution to permissive-error rows
      const rowsToInsert = validRows.map((r) => {
        const finalRow = r.permissiveErrors.length > 0
          ? applyNoAplica(r.validated, r.permissiveErrors)
          : r.validated;
        return {
          full_name: finalRow.full_name,
          email: finalRow.email,
          specialty: finalRow.specialty || undefined,
          institution: finalRow.institution || undefined,
          external_credential_code: externalCredentialsEnabled
            ? (finalRow.external_credential_code || null)
            : null,
          registration_status: finalRow.registration_status,
        };
      });

      const result = await bulkMutation.mutateAsync({
        rows: rowsToInsert,
        registrationStatus: importStatus,
      });
      setProgress(80);

      if (importStatus === 'confirmed' && result.ids.length > 0) {
        try {
          await sendInvitationsMutation.mutateAsync(result.ids);
        } catch (invErr) {
          console.error('Failed to send invitations:', invErr);
        }
      }
      setProgress(100);

      setImportResult({
        imported: result.inserted,
        blocked: blockedRows.length,
        permissiveFixed: rowsWithPermissiveErrors.length,
        blockedRows,
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
    <>
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
                  {importResult.permissiveFixed > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      {t('attendees.importModal.summaryPermissive', { count: importResult.permissiveFixed })}
                    </div>
                  )}
                  {importResult.blocked > 0 && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {t('attendees.importModal.summaryBlocked', { count: importResult.blocked })}
                    </div>
                  )}
                </CardContent>
              </Card>
              {importResult.blockedRows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setErrorsModalOpen(true)}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  {t('attendees.importModal.viewBlockedRows', { count: importResult.blockedRows.length })}
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

              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1 text-accent">
                  <CheckCircle2 className="h-3 w-3" />
                  {validRows.length - rowsWithPermissiveErrors.length} {t('attendees.importModal.validRow')}
                </span>
                {rowsWithPermissiveErrors.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    {rowsWithPermissiveErrors.length} {t('attendees.importModal.permissiveRow')}
                  </span>
                )}
                {blockedRows.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {blockedRows.length} {t('attendees.importModal.blockedRow')}
                  </span>
                )}
              </div>

              <div className="text-sm font-medium text-foreground">{t('attendees.importModal.previewTitle')}</div>
              <div className="max-h-48 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>{t('attendees.importModal.colName')}</TableHead>
                      <TableHead>{t('attendees.importModal.colEmail')}</TableHead>
                      <TableHead>{t('attendees.importModal.columnStatus')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRows.slice(0, 20).map((r, i) => (
                      <TableRow
                        key={i}
                        className={cn(
                          !r.blocked && r.permissiveErrors.length === 0 && 'bg-accent/5',
                          !r.blocked && r.permissiveErrors.length > 0 && 'bg-amber-500/10',
                          r.blocked && 'bg-destructive/10',
                        )}
                      >
                        <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                        <TableCell className="text-sm">{r.validated.full_name || '—'}</TableCell>
                        <TableCell className="text-sm">{r.validated.email || '—'}</TableCell>
                        <TableCell>
                          {r.blocked ? (
                            <span className="text-xs text-destructive">
                              {t('attendees.importModal.blockedRow')}
                            </span>
                          ) : r.permissiveErrors.length > 0 ? (
                            <span className="text-xs text-amber-600">
                              {t('attendees.importModal.permissiveRow')}
                            </span>
                          ) : (
                            <span className="text-xs text-accent">
                              {t('attendees.importModal.validRow')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {processedRows.length > 20 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground">
                    +{processedRows.length - 20} más...
                  </div>
                )}
              </div>

              {blockedRows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setErrorsModalOpen(true)}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  {t('attendees.importModal.viewBlockedRows', { count: blockedRows.length })}
                </Button>
              )}

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
                disabled={bulkMutation.isPending || sendInvitationsMutation.isPending || validRows.length === 0}
              >
                {bulkMutation.isPending || sendInvitationsMutation.isPending
                  ? t('attendees.importModal.importing')
                  : blockedRows.length > 0
                    ? t('attendees.importModal.importValidOnly', { count: validRows.length })
                    : t('attendees.importModal.importButton', { count: validRows.length })}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImportErrorsModal
        open={errorsModalOpen}
        onOpenChange={setErrorsModalOpen}
        blockedRows={importResult?.blockedRows ?? blockedRows}
      />
    </>
  );
}
