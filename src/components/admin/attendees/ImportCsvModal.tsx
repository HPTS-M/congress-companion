import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, FileText, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  useBulkCreateAttendees,
  useBulkUpsertAttendees,
  useExistingEmails,
  useExistingExternalCodes,
  useSendInvitations,
  type UpsertResolution,
} from '@/hooks/useAdminAttendees';
import { useEvent } from '@/hooks/useEvent';
import { adminAttendeesService } from '@/services/admin-attendees.service';
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
import { ImportWarningsModal } from './ImportWarningsModal';
import {
  ResolveAmbiguousImportModal,
  type AmbiguousRow,
  type AmbiguousResolutionMap,
} from './ResolveAmbiguousImportModal';

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
  hasWarning?: boolean;
  duplicateInFile?: boolean;
  duplicateInDb?: boolean;
  duplicateExternalInFile?: boolean;
  duplicateExternalInDb?: boolean;
}

interface ImportResult {
  imported: number;
  blocked: number;
  permissiveFixed: number;
  warnings: number;
  blockedRows: ProcessedRow[];
  warningRows: ProcessedRow[];
  updated?: number;
  skipped?: number;
  upsertErrors?: number;
  /** Credentials emailed successfully. */
  invitationsSent?: number;
  /** Credential emails that failed (after retries). */
  invitationsFailed?: number;
  /** Recipients excluded server-side (cancelled / invalid email). */
  invitationsSkipped?: number;
  /** First-failure reason for at-a-glance debugging in the toast. */
  invitationsFirstError?: string;
}

async function downloadTemplate() {
  await writeExcelFile({
    filename: 'plantilla-asistentes.xlsx',
    sheetName: 'Asistentes',
    columns: [
      { header: 'Nombre completo', key: 'full_name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Código del congreso', key: 'external_credential_code', width: 28 },
      { header: 'Especialidad', key: 'specialty', width: 20 },
      { header: 'Institución', key: 'institution', width: 25 },
      { header: 'Estado', key: 'registration_status_id', width: 10 },
    ],
    rows: [
      {
        full_name: 'Dr. Juan Pérez',
        email: 'juan@ejemplo.com',
        external_credential_code: 'CMP-12345',
        specialty: 'Cardiología',
        institution: 'Hospital General',
        registration_status_id: 1,
      },
      {
        full_name: 'Dra. María López',
        email: 'maria@ejemplo.com',
        external_credential_code: 'CMP-67890',
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
  const upsertMutation = useBulkUpsertAttendees();
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
  const [warningsModalOpen, setWarningsModalOpen] = useState(false);
  const [confirmWarningsOpen, setConfirmWarningsOpen] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [matchesByEmail, setMatchesByEmail] = useState<Record<string, Array<{
    id: string; full_name: string; email: string; credential_code: string;
    external_credential_code: string | null; created_at: string | null;
  }>>>({});
  const [matchesByExternalCode, setMatchesByExternalCode] = useState<Record<string, {
    id: string; full_name: string; email: string; credential_code: string;
    external_credential_code: string | null;
  }>>({});
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [resolutionsByRow, setResolutionsByRow] = useState<AmbiguousResolutionMap>({});
  const [resolveModalOpen, setResolveModalOpen] = useState(false);

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

      // Email duplicates → WARNING (admin decides). External code duplicates → BLOCKING,
      // EXCEPT when "update existing" is enabled and the duplicate exists in DB
      // (in that case the row will be auto-updated against the existing attendee).
      const extraBlocking: FieldError[] = [];
      if (duplicateExternalInFile)
        extraBlocking.push({ field: 'external_credential_code', message: 'duplicate_in_file' });
      if (duplicateExternalInDb && !updateExisting)
        extraBlocking.push({ field: 'external_credential_code', message: 'duplicate_in_db' });

      const blockingErrors = [...classification.blockingErrors, ...extraBlocking];
      const blocked = blockingErrors.length > 0;
      const hasWarning = !blocked && (duplicateInFile || duplicateInDb);

      return {
        rowNumber: idx + 2, // +2 = header row + 1-based
        validated,
        blocked,
        blockingErrors,
        permissiveErrors: classification.permissiveErrors,
        hasWarning,
        duplicateInFile,
        duplicateInDb,
        duplicateExternalInFile,
        duplicateExternalInDb,
      };
    });
  }, [rawRows, existingEmailSet, existingExternalSet, externalCredentialsEnabled, updateExisting]);

  const validRows = processedRows.filter((r) => !r.blocked);
  const blockedRows = processedRows.filter((r) => r.blocked);
  const warningRows = processedRows.filter((r) => r.hasWarning);
  const rowsWithPermissiveErrors = validRows.filter((r) => r.permissiveErrors.length > 0);

  // Fetch DB matches for valid rows (for upsert classification)
  const eventId = event?.id;
  useEffect(() => {
    if (!eventId || validRows.length === 0) {
      setMatchesByEmail({});
      setMatchesByExternalCode({});
      return;
    }
    const emails = validRows.map((r) => r.validated.email).filter(Boolean);
    const externalCodes = externalCredentialsEnabled
      ? validRows.map((r) => r.validated.external_credential_code ?? '').filter(Boolean)
      : [];
    if (emails.length === 0 && externalCodes.length === 0) return;

    let cancelled = false;
    setMatchesLoading(true);

    Promise.all([
      emails.length > 0
        ? adminAttendeesService.lookupAttendeesByEmails(eventId, emails)
        : Promise.resolve({} as Record<string, never>),
      externalCodes.length > 0
        ? adminAttendeesService.lookupAttendeesByExternalCodes(eventId, externalCodes)
        : Promise.resolve({} as Record<string, never>),
    ])
      .then(([emailMap, codeMap]) => {
        if (!cancelled) {
          setMatchesByEmail(emailMap as typeof matchesByEmail);
          setMatchesByExternalCode(codeMap as typeof matchesByExternalCode);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatchesByEmail({});
          setMatchesByExternalCode({});
        }
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, rawRows, externalCredentialsEnabled]);

  // Classify valid rows for upsert mode.
  // PRIORITY: external_credential_code match (deterministic, unique by DB constraint)
  // → fallback to email match (may be ambiguous).
  const classifiedValidRows = useMemo(() => {
    return validRows.map((r) => {
      const codeUpper = (r.validated.external_credential_code ?? '').trim().toUpperCase();
      const codeMatch = codeUpper ? matchesByExternalCode[codeUpper] : undefined;

      if (codeMatch) {
        // Deterministic match by external code → auto-update, no ambiguity possible
        return {
          processed: r,
          matches: [{
            id: codeMatch.id,
            full_name: codeMatch.full_name,
            email: codeMatch.email,
            credential_code: codeMatch.credential_code,
            external_credential_code: codeMatch.external_credential_code,
            created_at: null,
          }],
          kind: 'updatable' as const,
          matchedBy: 'external_code' as const,
        };
      }

      const email = (r.validated.email ?? '').toLowerCase();
      const matches = email ? (matchesByEmail[email] ?? []) : [];
      let kind: 'new' | 'updatable' | 'ambiguous' = 'new';
      if (matches.length === 1) kind = 'updatable';
      else if (matches.length > 1) kind = 'ambiguous';
      return { processed: r, matches, kind, matchedBy: 'email' as const };
    });
  }, [validRows, matchesByEmail, matchesByExternalCode]);

  const newCount = classifiedValidRows.filter((c) => c.kind === 'new').length;
  const updatableCount = classifiedValidRows.filter((c) => c.kind === 'updatable').length;
  const ambiguousList = classifiedValidRows.filter((c) => c.kind === 'ambiguous');
  const ambiguousCount = ambiguousList.length;

  const ambiguousRows: AmbiguousRow[] = useMemo(
    () =>
      ambiguousList.map((c) => ({
        rowIndex: c.processed.rowNumber - 2,
        rowNumber: c.processed.rowNumber,
        fullName: c.processed.validated.full_name ?? '',
        email: c.processed.validated.email ?? '',
        incomingCongressCode: c.processed.validated.external_credential_code ?? '',
        candidates: c.matches,
      })),
    [ambiguousList],
  );

  const allAmbiguousResolved =
    ambiguousCount === 0 ||
    ambiguousRows.every((r) => resolutionsByRow[r.rowIndex] !== undefined);

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

  const upsertEnabled = updateExisting && (updatableCount > 0 || ambiguousCount > 0);

  const handleImportClick = () => {
    if (validRows.length === 0) return;
    if (upsertEnabled && !allAmbiguousResolved) return;
    if (warningRows.length > 0 && !upsertEnabled) {
      setConfirmWarningsOpen(true);
      return;
    }
    void runImport();
  };

  const buildRowPayload = (r: ProcessedRow) => {
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
  };

  const runImport = async () => {
    if (validRows.length === 0) return;

    try {
      setConfirmWarningsOpen(false);
      setProgress(10);

      if (upsertEnabled) {
        // Build resolutions for ALL valid rows (auto-create for new, auto-update
        // for single-match, manual resolution for ambiguous).
        const allRows = validRows.map(buildRowPayload);
        const resolutions = classifiedValidRows.map((c) => {
          const rowIndex = c.processed.rowNumber - 2;
          if (c.kind === 'new') {
            return { rowIndex, action: 'create' as const };
          }
          if (c.kind === 'updatable') {
            return {
              rowIndex,
              action: 'update' as const,
              targetAttendeeId: c.matches[0].id,
            };
          }
          // ambiguous → use manual resolution
          const manual = resolutionsByRow[rowIndex];
          if (!manual || manual.action === 'skip') {
            return { rowIndex, action: 'skip' as const };
          }
          if (manual.action === 'create') {
            return { rowIndex, action: 'create' as const };
          }
          return {
            rowIndex,
            action: 'update' as const,
            targetAttendeeId: manual.targetAttendeeId,
          };
        });

        const upsertResult = await upsertMutation.mutateAsync({
          rows: allRows,
          resolutions,
          registrationStatus: importStatus,
        });
        setProgress(80);

        if (importStatus === 'confirmed' && upsertResult.insertedIds.length > 0) {
          try {
            await sendInvitationsMutation.mutateAsync(upsertResult.insertedIds);
          } catch (invErr) {
            console.error('Failed to send invitations:', invErr);
          }
        }
        setProgress(100);

        setImportResult({
          imported: upsertResult.inserted,
          updated: upsertResult.updated,
          skipped: upsertResult.skipped,
          upsertErrors: upsertResult.errors.length,
          blocked: blockedRows.length,
          permissiveFixed: rowsWithPermissiveErrors.length,
          warnings: warningRows.length,
          blockedRows,
          warningRows,
        });

        toast({
          title: t('attendees.importModal.upsertSuccess', {
            inserted: upsertResult.inserted,
            updated: upsertResult.updated,
            skipped: upsertResult.skipped,
          }),
        });
        return;
      }

      // Default insert-only path
      const rowsToInsert = validRows.map(buildRowPayload);

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
        warnings: warningRows.length,
        blockedRows,
        warningRows,
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
                  {(importResult.updated ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <RefreshCw className="h-4 w-4" />
                      {t('attendees.importModal.summaryUpdated', { count: importResult.updated })}
                    </div>
                  )}
                  {(importResult.skipped ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      {t('attendees.importModal.summarySkipped', { count: importResult.skipped })}
                    </div>
                  )}
                  {importResult.permissiveFixed > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      {t('attendees.importModal.summaryPermissive', { count: importResult.permissiveFixed })}
                    </div>
                  )}
                  {importResult.warnings > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      {t('attendees.importModal.summaryWarnings', { count: importResult.warnings })}
                    </div>
                  )}
                  {(importResult.upsertErrors ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {t('attendees.importModal.summaryUpsertErrors', { count: importResult.upsertErrors })}
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
              {importResult.warningRows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWarningsModalOpen(true)}
                >
                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" />
                  {t('attendees.importModal.viewWarningRows', { count: importResult.warningRows.length })}
                </Button>
              )}
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
                  {validRows.length - rowsWithPermissiveErrors.length - warningRows.length} {t('attendees.importModal.validRow')}
                </span>
                {rowsWithPermissiveErrors.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    {rowsWithPermissiveErrors.length} {t('attendees.importModal.permissiveRow')}
                  </span>
                )}
                {warningRows.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    {warningRows.length} {t('attendees.importModal.warningRow')}
                  </span>
                )}
                {blockedRows.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {blockedRows.length} {t('attendees.importModal.blockedRow')}
                  </span>
                )}
              </div>

              {/* Upsert classification summary */}
              {(updatableCount > 0 || ambiguousCount > 0) && (
                <Card className="border-primary/30">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="update-existing"
                        checked={updateExisting}
                        onCheckedChange={(v) => setUpdateExisting(v === true)}
                        disabled={matchesLoading}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor="update-existing" className="text-sm font-medium cursor-pointer">
                          {t('attendees.importModal.updateExisting')}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('attendees.importModal.updateExistingDescription')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs pt-1">
                      <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5">
                        {t('attendees.importModal.summaryNew', { count: newCount })}
                      </span>
                      {updatableCount > 0 && (
                        <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5">
                          {t('attendees.importModal.summaryUpdatable', { count: updatableCount })}
                        </span>
                      )}
                      {ambiguousCount > 0 && (
                        <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5">
                          {t('attendees.importModal.summaryAmbiguous', { count: ambiguousCount })}
                        </span>
                      )}
                    </div>

                    {updateExisting && ambiguousCount > 0 && (
                      <Button
                        variant={allAmbiguousResolved ? 'outline' : 'default'}
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => setResolveModalOpen(true)}
                      >
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        {t('attendees.importModal.resolveButton', { count: ambiguousCount })}
                      </Button>
                    )}
                    {updateExisting && ambiguousCount > 0 && !allAmbiguousResolved && (
                      <p className="text-xs text-destructive">
                        {t('attendees.importModal.needsResolution')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

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
                          !r.blocked && !r.hasWarning && r.permissiveErrors.length === 0 && 'bg-accent/5',
                          !r.blocked && (r.hasWarning || r.permissiveErrors.length > 0) && 'bg-amber-500/10',
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
                          ) : r.hasWarning ? (
                            <span className="text-xs text-amber-600">
                              {t('attendees.importModal.warningRow')}
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

              {warningRows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setWarningsModalOpen(true)}
                >
                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" />
                  {t('attendees.importModal.viewWarningRows', { count: warningRows.length })}
                </Button>
              )}

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
                onClick={handleImportClick}
                disabled={
                  bulkMutation.isPending ||
                  upsertMutation.isPending ||
                  sendInvitationsMutation.isPending ||
                  validRows.length === 0 ||
                  (upsertEnabled && !allAmbiguousResolved)
                }
              >
                {bulkMutation.isPending || upsertMutation.isPending || sendInvitationsMutation.isPending
                  ? t('attendees.importModal.importing')
                  : blockedRows.length > 0
                    ? t('attendees.importModal.importValidOnly', { count: validRows.length })
                    : t('attendees.importModal.importButton', { count: validRows.length })}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ResolveAmbiguousImportModal
        open={resolveModalOpen}
        onOpenChange={setResolveModalOpen}
        ambiguousRows={ambiguousRows}
        onResolve={(map) => setResolutionsByRow(map)}
      />

      <ImportErrorsModal
        open={errorsModalOpen}
        onOpenChange={setErrorsModalOpen}
        blockedRows={importResult?.blockedRows ?? blockedRows}
      />

      <ImportWarningsModal
        open={warningsModalOpen}
        onOpenChange={setWarningsModalOpen}
        warningRows={importResult?.warningRows ?? warningRows}
        onConfirm={() => setWarningsModalOpen(false)}
      />

      <ImportWarningsModal
        open={confirmWarningsOpen}
        onOpenChange={setConfirmWarningsOpen}
        warningRows={warningRows}
        onConfirm={() => void runImport()}
      />
    </>
  );
}
