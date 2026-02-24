import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  parseAgendaFile,
  validateImportRows,
  downloadAgendaTemplate,
  downloadErrorReport,
  type ImportRow,
  type ValidatedImportRow,
} from '@/services/admin-agenda-excel.service';
import { adminAgendaService, type SessionFormData } from '@/services/admin-agenda.service';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onImported: () => void;
}

export function ImportAgendaModal({ open, onClose, eventId, onImported }: Props) {
  const { t } = useTranslation('admin');
  const [rawRows, setRawRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);

  const validated = useMemo(() => validateImportRows(rawRows), [rawRows]);
  const validCount = validated.filter((r) => r.valid).length;
  const errorCount = validated.filter((r) => !r.valid).length;

  const reset = useCallback(() => {
    setRawRows([]);
    setFileName('');
    setImporting(false);
    setProgress(0);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error(t('agenda.import.invalidFormat'));
      return;
    }
    try {
      const rows = await parseAgendaFile(file);
      setRawRows(rows);
      setFileName(file.name);
      setResult(null);
    } catch {
      toast.error(t('agenda.import.parseError'));
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    const valid = validated.filter((r) => r.valid);
    if (valid.length === 0) return;

    setImporting(true);
    setProgress(0);
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      try {
        const form: SessionFormData = {
          title: row.titulo.trim(),
          activity_type: row.activityType ?? 'talk',
          scheduled_date: row.fecha?.trim() || new Date().toISOString().slice(0, 10),
          start_time: row.hora_inicio,
          end_time: row.hora_fin,
          location: row.sala?.trim() || '',
          speaker_name: row.ponente?.trim() || '',
          speaker_bio: row.origen_ponente?.trim() || '',
          description: row.descripcion?.trim() || '',
          requires_checkin: row.tiene_certificado?.toUpperCase() === 'SI',
          capacity: row.capacidad_maxima ? parseInt(row.capacidad_maxima) || null : null,
        };
        await adminAgendaService.createSession(eventId, form);
        imported++;
      } catch {
        errors++;
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    setResult({ imported, errors: errors + errorCount });
    setImporting(false);
    if (imported > 0) onImported();
  }, [validated, eventId, errorCount, onImported]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--primary))]" />
            {t('agenda.import.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Result view */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
              <CheckCircle2 className="h-6 w-6 text-[hsl(168,76%,36%)]" />
              <div>
                <p className="font-semibold text-foreground">
                  {t('agenda.import.resultImported', { count: result.imported })}
                  {result.errors > 0 && ` | ${t('agenda.import.resultErrors', { count: result.errors })}`}
                </p>
              </div>
            </div>
            {result.errors > 0 && (
              <Button variant="outline" size="sm" onClick={() => downloadErrorReport(validated)}>
                <Download className="mr-1 h-4 w-4" />
                {t('agenda.import.downloadErrors')}
              </Button>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>{t('agenda.import.close')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* File selection */}
        {!result && rawRows.length === 0 && (
          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={downloadAgendaTemplate}>
              <Download className="mr-1 h-4 w-4" />
              {t('agenda.import.downloadTemplate')}
            </Button>

            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-[hsl(var(--primary))]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">{t('agenda.import.dropHere')}</p>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <span className="cursor-pointer text-sm font-medium text-[hsl(var(--primary))] underline">
                  {t('agenda.import.selectFile')}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Preview */}
        {!result && rawRows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{fileName}</p>
              <div className="flex gap-2">
                <Badge variant="default" className="bg-[hsl(168,76%,36%)] text-white">
                  {validCount} {t('agenda.import.valid')}
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    {errorCount} {t('agenda.import.invalid')}
                  </Badge>
                )}
              </div>
            </div>

            {importing && <Progress value={progress} className="h-2" />}

            <div className="max-h-[40vh] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('agenda.import.colTitle')}</TableHead>
                    <TableHead>{t('agenda.import.colTime')}</TableHead>
                    <TableHead>{t('agenda.import.colType')}</TableHead>
                    <TableHead>{t('agenda.import.colRoom')}</TableHead>
                    <TableHead>{t('agenda.import.colStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validated.slice(0, 50).map((row, i) => (
                    <TableRow key={i} className={row.valid ? '' : 'bg-destructive/10'}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium truncate max-w-[200px]">{row.titulo}</TableCell>
                      <TableCell className="text-xs">{row.hora_inicio}–{row.hora_fin}</TableCell>
                      <TableCell className="text-xs">{row.tipo_actividad}</TableCell>
                      <TableCell className="text-xs">{row.sala}</TableCell>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-[hsl(168,76%,36%)]" />
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {row.errors[0]}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>{t('agenda.import.changeFile')}</Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importing}
                style={{ backgroundColor: 'hsl(var(--primary))' }}
              >
                {importing
                  ? `${t('agenda.import.importing')}... ${progress}%`
                  : t('agenda.import.importButton', { count: validCount })}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
