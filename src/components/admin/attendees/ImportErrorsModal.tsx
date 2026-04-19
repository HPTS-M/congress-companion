import { useTranslation } from 'react-i18next';
import { Download, AlertCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { writeExcelFile } from '@/lib/excel';
import type { ProcessedRow } from './ImportCsvModal';
import type { FieldError, FieldKey } from '@/lib/import-validators';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockedRows: ProcessedRow[];
}

function formatErrors(errors: FieldError[], t: (k: string) => string): string {
  return errors
    .map((e) => {
      const fieldLabel = t(`attendees.importErrorsModal.field.${e.field}`);
      const messageLabel = t(`attendees.importErrorsModal.error.${e.message}`);
      return `${fieldLabel}: ${messageLabel}`;
    })
    .join('; ');
}

function fieldValue(row: ProcessedRow, field: FieldKey): string {
  const v = row.validated;
  switch (field) {
    case 'full_name': return v.full_name;
    case 'email': return v.email;
    case 'external_credential_code': return v.external_credential_code;
    case 'specialty': return v.specialty;
    case 'institution': return v.institution;
    case 'registration_status_id': return v.registration_status;
    default: return '';
  }
}

export function ImportErrorsModal({ open, onOpenChange, blockedRows }: Props) {
  const { t } = useTranslation('admin');

  const handleDownload = async () => {
    await writeExcelFile({
      filename: 'errores-importacion.xlsx',
      sheetName: 'Errores',
      columns: [
        { header: t('attendees.importErrorsModal.colRow'), key: 'rowNumber', width: 8 },
        { header: t('attendees.importErrorsModal.colName'), key: 'full_name', width: 30 },
        { header: t('attendees.importErrorsModal.colEmail'), key: 'email', width: 30 },
        { header: t('attendees.importErrorsModal.colExternalCode'), key: 'external_credential_code', width: 22 },
        { header: t('attendees.importErrorsModal.colSpecialty'), key: 'specialty', width: 20 },
        { header: t('attendees.importErrorsModal.colInstitution'), key: 'institution', width: 25 },
        { header: t('attendees.importErrorsModal.colStatus'), key: 'registration_status', width: 12 },
        { header: t('attendees.importErrorsModal.colErrors'), key: 'errors', width: 60 },
      ],
      rows: blockedRows.map((r) => ({
        rowNumber: r.rowNumber,
        full_name: r.validated.full_name,
        email: r.validated.email,
        external_credential_code: r.validated.external_credential_code,
        specialty: r.validated.specialty,
        institution: r.validated.institution,
        registration_status: r.validated.registration_status,
        errors: formatErrors(r.blockingErrors, t),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {t('attendees.importErrorsModal.title')}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t('attendees.importErrorsModal.description', { count: blockedRows.length })}
        </p>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            {t('attendees.importErrorsModal.downloadExcel')}
          </Button>
        </div>

        <div className="rounded border overflow-auto max-h-[55vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t('attendees.importErrorsModal.colName')}</TableHead>
                <TableHead>{t('attendees.importErrorsModal.colEmail')}</TableHead>
                <TableHead>{t('attendees.importErrorsModal.colErrors')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedRows.map((r) => (
                <TableRow key={r.rowNumber} className="bg-destructive/5">
                  <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                  <TableCell className="text-sm">{r.validated.full_name || '—'}</TableCell>
                  <TableCell className="text-sm">{r.validated.email || '—'}</TableCell>
                  <TableCell className="text-xs text-destructive">
                    {formatErrors(r.blockingErrors, t)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button onClick={() => onOpenChange(false)} className="w-full">
          {t('attendees.importErrorsModal.close')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
