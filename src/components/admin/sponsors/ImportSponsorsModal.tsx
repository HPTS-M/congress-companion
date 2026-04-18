import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Download, Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminSponsorsService } from '@/services/admin-sponsors.service';
import {
  parseSponsorFile,
  validateSponsorRows,
  downloadSponsorTemplate,
  type SponsorImportRow,
} from '@/services/admin-sponsors-excel.service';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onImported: () => void;
}

type Strategy = 'skip' | 'update';

export function ImportSponsorsModal({ open, onClose, eventId, onImported }: Props) {
  const { t } = useTranslation('admin');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawRows, setRawRows] = useState<SponsorImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated: number; errors: number } | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('skip');
  const [existingByName, setExistingByName] = useState<Map<string, string>>(new Map());

  // Pre-fetch existing sponsors when modal opens to detect duplicates
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    adminSponsorsService.getAll(eventId)
      .then((list) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        list.forEach(s => map.set(s.name.trim().toLowerCase(), s.id));
        setExistingByName(map);
      })
      .catch(() => { if (!cancelled) setExistingByName(new Map()); });
    return () => { cancelled = true; };
  }, [open, eventId]);

  const validated = useMemo(() => validateSponsorRows(rawRows, existingByName), [rawRows, existingByName]);
  const validCount = validated.filter(r => r.isValid && (!r.isDuplicate || strategy === 'update')).length;
  const duplicateCount = validated.filter(r => r.isDuplicate).length;
  const invalidCount = validated.filter(r => !r.isValid).length;
  const newCount = validated.filter(r => r.isValid && !r.isDuplicate).length;

  const reset = useCallback(() => {
    setRawRows([]);
    setFileName('');
    setResult(null);
    setStrategy('skip');
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
    setImporting(true);
    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const row of validated) {
      if (!row.isValid) continue;
      if (row.isDuplicate && strategy === 'skip') continue;

      const payload = {
        name: row.nombre,
        level: row.mappedLevel!,
        category: row.mappedCategory || 'other',
        stand_location: row.stand || undefined,
        website_url: row.website || undefined,
        contact_email: row.email_contacto || undefined,
        whatsapp: row.whatsapp ? row.whatsapp.replace(/[\s\-()]/g, '') : undefined,
        description: row.descripcion || undefined,
        social_linkedin: row.linkedin || undefined,
        social_instagram: row.instagram || undefined,
      };

      try {
        if (row.isDuplicate && row.existingId && strategy === 'update') {
          await adminSponsorsService.update(row.existingId, payload);
          updated++;
        } else {
          await adminSponsorsService.create(eventId, payload);
          imported++;
        }
      } catch {
        errors++;
      }
    }

    setResult({ imported, updated, errors });
    setImporting(false);
    if (imported > 0 || updated > 0) {
      qc.invalidateQueries({ queryKey: ['admin-sponsors', eventId] });
      onImported();
    }
  }, [validated, strategy, eventId, qc, onImported]);

  const totalToProcess = validCount;

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
              {result.updated > 0 && (
                <p className="text-sm text-foreground">
                  {t('sponsors.import.resultUpdated', { count: result.updated })}
                </p>
              )}
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{fileName}</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  {newCount} {t('sponsors.import.statusNew')}
                </Badge>
                {duplicateCount > 0 && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    {duplicateCount} {t('sponsors.import.statusDuplicate')}
                  </Badge>
                )}
                {invalidCount > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    {invalidCount} {t('sponsors.import.statusInvalid')}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                {t('sponsors.import.changeFile')}
              </Button>
            </div>

            {duplicateCount > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <Label className="text-sm font-medium">{t('sponsors.import.duplicateStrategyLabel')}</Label>
                <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as Strategy)} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="skip" id="skip" />
                    <Label htmlFor="skip" className="text-sm font-normal cursor-pointer">{t('sponsors.import.duplicateStrategySkip')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update" className="text-sm font-normal cursor-pointer">{t('sponsors.import.duplicateStrategyUpdate')}</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

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
                  {validated.slice(0, 50).map((row, i) => {
                    const status = !row.isValid ? 'invalid' : row.isDuplicate ? 'duplicate' : 'new';
                    return (
                      <TableRow key={i} className={!row.isValid ? 'bg-red-50 dark:bg-red-950/20' : row.isDuplicate ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{row.nombre || '—'}</TableCell>
                        <TableCell className="text-sm">{row.nivel || '—'}</TableCell>
                        <TableCell className="text-sm">{row.categoria || '—'}</TableCell>
                        <TableCell>
                          {status === 'invalid' ? (
                            <span className="text-xs text-destructive">{row.errors.join(', ')}</span>
                          ) : status === 'duplicate' ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">
                              {t('sponsors.import.statusDuplicate')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                              {t('sponsors.import.statusNew')}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>{t('sponsors.cancel')}</Button>
              <Button
                onClick={handleImport}
                disabled={totalToProcess === 0 || importing}
                className="bg-primary text-primary-foreground"
              >
                {importing
                  ? t('sponsors.import.importing')
                  : t('sponsors.import.importButton', { count: totalToProcess })
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
