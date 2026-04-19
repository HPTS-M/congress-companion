import { useTranslation } from 'react-i18next';
import { Download, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { writeExcelFile } from '@/lib/excel';
import type { ProcessedRow } from './ImportCsvModal';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warningRows: ProcessedRow[];
  onConfirm: () => void;
}

function formatWarnings(r: ProcessedRow, t: (k: string) => string): string {
  const parts: string[] = [];
  if (r.duplicateInFile) parts.push(t('attendees.importWarningsModal.reason.duplicateEmailFile'));
  if (r.duplicateInDb) parts.push(t('attendees.importWarningsModal.reason.duplicateEmailDb'));
  return parts.join('; ');
}

export function ImportWarningsModal({ open, onOpenChange, warningRows, onConfirm }: Props) {
  const { t } = useTranslation('admin');

  const handleDownload = async () => {
    await writeExcelFile({
      filename: 'advertencias-importacion.xlsx',
      sheetName: 'Advertencias',
      columns: [
        { header: t('attendees.importErrorsModal.colRow'), key: 'rowNumber', width: 8 },
        { header: t('attendees.importErrorsModal.colName'), key: 'full_name', width: 30 },
        { header: t('attendees.importErrorsModal.colEmail'), key: 'email', width: 30 },
        { header: t('attendees.importErrorsModal.colExternalCode'), key: 'external_credential_code', width: 22 },
        { header: t('attendees.importErrorsModal.colSpecialty'), key: 'specialty', width: 20 },
        { header: t('attendees.importErrorsModal.colInstitution'), key: 'institution', width: 25 },
        { header: t('attendees.importErrorsModal.colStatus'), key: 'registration_status', width: 12 },
        { header: t('attendees.importWarningsModal.colReason'), key: 'reason', width: 60 },
      ],
      rows: warningRows.map((r) => ({
        rowNumber: r.rowNumber,
        full_name: r.validated.full_name,
        email: r.validated.email,
        external_credential_code: r.validated.external_credential_code,
        specialty: r.validated.specialty,
        institution: r.validated.institution,
        registration_status: r.validated.registration_status,
        reason: formatWarnings(r, t),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            {t('attendees.importWarningsModal.title')}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t('attendees.importWarningsModal.description', { count: warningRows.length })}
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-3">
          {t('attendees.importWarningsModal.riskNote')}
        </p>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            {t('attendees.importWarningsModal.downloadExcel')}
          </Button>
        </div>

        <div className="rounded border overflow-auto max-h-[45vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t('attendees.importErrorsModal.colName')}</TableHead>
                <TableHead>{t('attendees.importErrorsModal.colEmail')}</TableHead>
                <TableHead>{t('attendees.importWarningsModal.colReason')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warningRows.map((r) => (
                <TableRow key={r.rowNumber} className="bg-amber-500/5">
                  <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                  <TableCell className="text-sm">{r.validated.full_name || '—'}</TableCell>
                  <TableCell className="text-sm">{r.validated.email || '—'}</TableCell>
                  <TableCell className="text-xs text-amber-700 dark:text-amber-400">
                    {formatWarnings(r, t)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('attendees.importWarningsModal.cancel')}
          </Button>
          <Button onClick={onConfirm}>
            {t('attendees.importWarningsModal.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
