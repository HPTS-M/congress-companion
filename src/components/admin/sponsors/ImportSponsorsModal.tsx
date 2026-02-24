import { useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminSponsorsService } from '@/services/admin-sponsors.service';
import {
  parseSponsorFile,
  validateSponsorRows,
  downloadSponsorTemplate,
  type SponsorImportRow,
  type ValidatedSponsorRow,
} from '@/services/admin-sponsors-excel.service';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onImported: () => void;
}

export function ImportSponsorsModal({ open, onClose, eventId, onImported }: Props) {
  const { t } = useTranslation('admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawRows, setRawRows] = useState<SponsorImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);

  const validated = useMemo(() => validateSponsorRows(rawRows), [rawRows]);
  const validCount = validated.filter(r => r.isValid).length;
  const invalidCount = validated.filter(r => !r.isValid).length;

  const reset = useCallback(() => {
    setRawRows([]);
    setFileName('');
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error(t('sponsors.import.invalidFormat'));
      return;
    }
    try {
      const rows = await parseSponsorFile(file);
      setRawRows(rows);
      setFileName(file.name);
    } catch {
      toast.error(t('sponsors.import.parseError'));
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    const validRows = validated.filter(r => r.isValid);
    if (validRows.length === 0) return;
    setImporting(true);
    let imported = 0;
    let errors = 0;
    for (const row of validRows) {
      try {
        await adminSponsorsService.create(eventId, {
          name: row.nombre,
          level: row.mappedLevel!,
          category: row.mappedCategory || 'other',
          stand_location: row.stand || undefined,
          website_url: row.website || undefined,
          contact_email: row.email_contacto || undefined,
          whatsapp: row.whatsapp || undefined,
          description: row.descripcion || undefined,
          social_linkedin: row.linkedin || undefined,
          social_instagram: row.instagram || undefined,
        });
        imported++;
      } catch {
        errors++;
      }
    }
    setResult({ imported, errors });
    setImporting(false);
    if (imported > 0) onImported();
  }, [validated, eventId, onImported]);

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('sponsors.import.title')}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold text-foreground">
                {t('sponsors.import.resultImported', { count: result.imported })}
              </p>
              {result.errors > 0 && (
                <p className="text-sm text-destructive">
                  {t('sponsors.import.resultErrors', { count: result.errors })}
                </p>
              )}
            </div>
            <div className="flex justify-center">
              <Button onClick={handleClose}>{t('sponsors.import.close')}</Button>
            </div>
          </div>
        ) : rawRows.length === 0 ? (
          <div className="space-y-4 py-4">
            <Button variant="outline" onClick={() => downloadSponsorTemplate()}>
              <Download className="mr-1 h-4 w-4" /> {t('sponsors.import.downloadTemplate')}
            </Button>
            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t('sponsors.import.dropHere')}</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{fileName}</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  {validCount} {t('sponsors.import.valid')}
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    {invalidCount} {t('sponsors.import.invalid')}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                {t('sponsors.import.changeFile')}
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('sponsors.import.colName')}</TableHead>
                    <TableHead>{t('sponsors.import.colLevel')}</TableHead>
                    <TableHead>{t('sponsors.import.colCategory')}</TableHead>
                    <TableHead>{t('sponsors.import.colStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validated.slice(0, 50).map((row, i) => (
                    <TableRow key={i} className={row.isValid ? '' : 'bg-red-50 dark:bg-red-950/20'}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{row.nombre || '—'}</TableCell>
                      <TableCell className="text-sm">{row.nivel || '—'}</TableCell>
                      <TableCell className="text-sm">{row.categoria || '—'}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-xs text-destructive">{row.errors.join(', ')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>{t('sponsors.cancel')}</Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importing}
                className="bg-primary text-primary-foreground"
              >
                {importing
                  ? t('sponsors.import.importing')
                  : t('sponsors.import.importButton', { count: validCount })
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
