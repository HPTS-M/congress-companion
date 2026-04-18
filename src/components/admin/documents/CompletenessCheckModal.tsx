import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { readExcelFile, writeExcelFile } from '@/lib/excel';
import type { DocumentWithSession } from '@/services/admin-documents.service';

interface Props {
  open: boolean;
  onClose: () => void;
  documents: DocumentWithSession[];
}

interface RefRow {
  titulo_esperado: string;
  sesion: string;
  tipo: string;
}

interface CompareResult {
  found: { ref: RefRow; doc: DocumentWithSession }[];
  missing: RefRow[];
  extra: DocumentWithSession[];
}

export function CompletenessCheckModal({ open, onClose, documents }: Props) {
  const { t } = useTranslation('admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [refRows, setRefRows] = useState<RefRow[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const json = await readExcelFile(file);

    const rows: RefRow[] = json.map((r) => ({
      titulo_esperado: String(r['titulo_esperado'] ?? r['titulo'] ?? r['title'] ?? '').trim(),
      sesion: String(r['sesion'] ?? r['session'] ?? '').trim(),
      tipo: String(r['tipo'] ?? r['type'] ?? '').trim().toLowerCase(),
    })).filter((r) => r.titulo_esperado.length > 0);

    setRefRows(rows);

    const docTitles = new Map<string, DocumentWithSession>();
    for (const d of documents) {
      docTitles.set(d.title.toLowerCase().trim(), d);
    }

    const found: CompareResult['found'] = [];
    const missing: RefRow[] = [];
    const matchedIds = new Set<string>();

    for (const ref of rows) {
      const key = ref.titulo_esperado.toLowerCase();
      const doc = docTitles.get(key);
      if (doc) {
        found.push({ ref, doc });
        matchedIds.add(doc.id);
      } else {
        missing.push(ref);
      }
    }

    const extra = documents.filter((d) => !matchedIds.has(d.id));
    setResult({ found, missing, extra });
  }, [documents]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDownloadReport = useCallback(async () => {
    if (!result) return;
    const rows: Record<string, string>[] = [];

    for (const r of result.found) {
      rows.push({ Estado: '✅ Encontrado', Título: r.ref.titulo_esperado, Sesión: r.ref.sesion, Tipo: r.ref.tipo });
    }
    for (const r of result.missing) {
      rows.push({ Estado: '❌ Faltante', Título: r.titulo_esperado, Sesión: r.sesion, Tipo: r.tipo });
    }
    for (const d of result.extra) {
      rows.push({ Estado: '⚠️ Extra', Título: d.title, Sesión: d.session_title ?? '', Tipo: d.file_type ?? '' });
    }

    await writeExcelFile({
      filename: 'reporte-completitud-documentos.xlsx',
      sheetName: 'Reporte',
      columns: [
        { header: 'Estado', key: 'Estado', width: 15 },
        { header: 'Título', key: 'Título', width: 40 },
        { header: 'Sesión', key: 'Sesión', width: 30 },
        { header: 'Tipo', key: 'Tipo', width: 10 },
      ],
      rows,
    });
  }, [result]);

  const reset = useCallback(() => {
    setRefRows([]);
    setResult(null);
    setFileName('');
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('documents.completeness.title')}</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('documents.completeness.description')}</p>
            <p className="text-xs text-muted-foreground">{t('documents.completeness.columnsExtended')}</p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t('documents.completeness.dropHere')}</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('documents.completeness.fileLoaded', { name: fileName, count: refRows.length })}</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-3 text-center">
                <CheckCircle2 className="mx-auto h-5 w-5 text-green-600 mb-1" />
                <p className="text-lg font-bold text-green-700 dark:text-green-400">{result.found.length}</p>
                <p className="text-xs text-green-600 dark:text-green-400">{t('documents.completeness.found')}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-center">
                <XCircle className="mx-auto h-5 w-5 text-red-600 mb-1" />
                <p className="text-lg font-bold text-red-700 dark:text-red-400">{result.missing.length}</p>
                <p className="text-xs text-red-600 dark:text-red-400">{t('documents.completeness.missing')}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-center">
                <AlertTriangle className="mx-auto h-5 w-5 text-amber-600 mb-1" />
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{result.extra.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">{t('documents.completeness.extra')}</p>
              </div>
            </div>

            {result.missing.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-600 mb-2">❌ {t('documents.completeness.missingList')}</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.missing.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-foreground bg-red-50 dark:bg-red-900/10 rounded px-2 py-1">
                      <span className="font-medium">{r.titulo_esperado}</span>
                      {r.sesion && <span className="text-xs text-muted-foreground">({r.sesion})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.extra.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-amber-600 mb-2">⚠️ {t('documents.completeness.extraList')}</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.extra.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm text-foreground bg-amber-50 dark:bg-amber-900/10 rounded px-2 py-1">
                      <span className="font-medium">{d.title}</span>
                      <Badge variant="secondary" className="text-xs">{(d.file_type ?? '').toUpperCase()}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                <Download className="mr-1 h-4 w-4" />
                {t('documents.completeness.downloadReport')}
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                {t('documents.completeness.changeFile')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
