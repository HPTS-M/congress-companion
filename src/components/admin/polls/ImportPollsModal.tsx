import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { readExcelFile, writeExcelAoa } from '@/lib/excel';

const VALID_TYPES = ['single_choice', 'multiple_choice', 'rating_scale', 'open_text'];

interface ParsedRow {
  question: string;
  type: string;
  sessionTitle: string;
  options: string[];
  status: 'valid' | 'warning' | 'error';
  issue: string;
  sessionId: string | null;
}

interface ImportPollsModalProps {
  open: boolean;
  onClose: () => void;
  sessions: { id: string; title: string; scheduled_date: string; start_time: string }[];
  onImport: (polls: { question: string; pollType: string; sessionId: string | null; options: string[] }[]) => Promise<{ imported: number; errors: { row: number; error: string }[] }>;
}

export function ImportPollsModal({ open, onClose, sessions, onImport }: ImportPollsModalProps) {
  const { t } = useTranslation('admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: { row: number; error: string }[] } | null>(null);

  const downloadTemplate = useCallback(async () => {
    const headers = ['pregunta', 'tipo', 'sesion_titulo', 'opcion_1', 'opcion_2', 'opcion_3', 'opcion_4', 'opcion_5'];
    const example = ['¿Qué tema te interesó más?', 'single_choice', '', 'Opción A', 'Opción B', 'Opción C', '', ''];
    await writeExcelAoa({
      filename: 'plantilla_encuestas.xlsx',
      sheetName: 'Encuestas',
      data: [headers, example],
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    try {
      const data = await readExcelFile(file);
      if (data.length === 0) return;

      const parsed: ParsedRow[] = data.map(row => {
        const question = String(row['pregunta'] ?? '').trim();
        const type = String(row['tipo'] ?? '').trim().toLowerCase();
        const sessionTitle = String(row['sesion_titulo'] ?? '').trim();
        const options: string[] = [];
        for (let i = 1; i <= 5; i++) {
          const val = String(row[`opcion_${i}`] ?? '').trim();
          if (val) options.push(val);
        }

        let status: 'valid' | 'warning' | 'error' = 'valid';
        let issue = '';
        let sessionId: string | null = null;

        if (!question) { status = 'error'; issue = t('polls.import.missingQuestion'); }
        else if (!type || !VALID_TYPES.includes(type)) { status = 'error'; issue = t('polls.import.invalidType'); }
        else if ((type === 'single_choice' || type === 'multiple_choice') && options.length < 2) {
          status = 'error'; issue = t('polls.import.minOptions');
        }

        if (sessionTitle && status !== 'error') {
          const match = sessions.find(s => s.title.toLowerCase() === sessionTitle.toLowerCase());
          if (match) {
            sessionId = match.id;
          } else {
            status = 'warning';
            issue = t('polls.import.sessionNotFound');
          }
        }

        return { question, type, sessionTitle, options, status, issue, sessionId };
      });

      setRows(parsed);
      setResult(null);
    } catch {
      // parse error
    }
  }, [sessions, t]);

  const validRows = rows.filter(r => r.status !== 'error');

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const pollsToImport = validRows.map(r => ({
        question: r.question,
        pollType: r.type,
        sessionId: r.sessionId,
        options: r.options,
      }));
      const res = await onImport(pollsToImport);
      setResult(res);
    } finally {
      setImporting(false);
    }
  }, [validRows, onImport]);

  const downloadErrors = useCallback(async () => {
    if (!result?.errors.length) return;
    const headers = ['Fila', 'Error'];
    const errorRows = result.errors.map(e => [String(e.row), e.error]);
    await writeExcelAoa({
      filename: 'errores_encuestas.xlsx',
      sheetName: 'Errores',
      data: [headers, ...errorRows],
    });
  }, [result]);

  const handleClose = () => {
    setRows([]);
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('polls.import.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1 h-4 w-4" />
            {t('polls.import.downloadTemplate')}
          </Button>

          {rows.length === 0 && !result && (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t('polls.import.dropHere')}</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {rows.length > 0 && !result && (
            <>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="text-teal-700 border-teal-300">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {validRows.length} {t('polls.import.valid')}
                </Badge>
                {rows.filter(r => r.status === 'warning').length > 0 && (
                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {rows.filter(r => r.status === 'warning').length} {t('polls.import.warnings')}
                  </Badge>
                )}
                {rows.filter(r => r.status === 'error').length > 0 && (
                  <Badge variant="outline" className="text-red-700 border-red-300">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    {rows.filter(r => r.status === 'error').length} {t('polls.import.errors')}
                  </Badge>
                )}
              </div>

              <div className="max-h-[300px] overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('polls.import.colQuestion')}</TableHead>
                      <TableHead>{t('polls.import.colType')}</TableHead>
                      <TableHead>{t('polls.import.colSession')}</TableHead>
                      <TableHead>{t('polls.import.colOptions')}</TableHead>
                      <TableHead>{t('polls.import.colStatus')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => (
                      <TableRow key={idx} className={
                        row.status === 'error' ? 'bg-red-50 dark:bg-red-900/10' :
                        row.status === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10' : ''
                      }>
                        <TableCell className="max-w-[200px] truncate text-sm">{row.question || '—'}</TableCell>
                        <TableCell className="text-sm">{row.type || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.sessionTitle || '—'}</TableCell>
                        <TableCell className="text-sm">{row.options.length}</TableCell>
                        <TableCell>
                          {row.status === 'valid' && <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                          {row.status === 'warning' && (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle className="h-3 w-3" />{row.issue}
                            </span>
                          )}
                          {row.status === 'error' && (
                            <span className="flex items-center gap-1 text-xs text-red-600">
                              <AlertCircle className="h-3 w-3" />{row.issue}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = ''; }}>
                  {t('polls.import.changeFile')}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validRows.length === 0 || importing}
                  className="bg-[hsl(var(--primary))]"
                >
                  {importing ? t('polls.import.importing') : t('polls.import.importButton', { count: validRows.length })}
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3 text-center py-4">
              <p className="text-lg font-semibold">
                {t('polls.import.resultImported', { count: result.imported })}
              </p>
              {result.errors.length > 0 && (
                <>
                  <p className="text-sm text-destructive">
                    {t('polls.import.resultErrors', { count: result.errors.length })}
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadErrors}>
                    <Download className="mr-1 h-4 w-4" />
                    {t('polls.import.downloadErrors')}
                  </Button>
                </>
              )}
              <div>
                <Button onClick={handleClose}>{t('polls.import.close')}</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
