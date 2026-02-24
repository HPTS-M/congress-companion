import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download } from 'lucide-react';
import type { DocumentWithSession } from '@/services/admin-documents.service';
import type { EventActivity, CongressEvent } from '@/types';
import * as XLSX from 'xlsx';

interface Props {
  open: boolean;
  onClose: () => void;
  documents: DocumentWithSession[];
  activities: Pick<EventActivity, 'id' | 'title' | 'scheduled_date'>[];
  event: CongressEvent | null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface IndexGroup {
  label: string;
  date: string | null;
  docs: DocumentWithSession[];
}

export function DocumentIndexModal({ open, onClose, documents, activities, event }: Props) {
  const { t } = useTranslation('admin');

  const activityMap = useMemo(() => {
    const m = new Map<string, { title: string; scheduled_date: string }>();
    for (const a of activities) m.set(a.id, { title: a.title, scheduled_date: a.scheduled_date });
    return m;
  }, [activities]);

  const { groups, totalSize } = useMemo(() => {
    const general: DocumentWithSession[] = [];
    const byDate = new Map<string, DocumentWithSession[]>();

    for (const doc of documents) {
      if (!doc.session_id) {
        general.push(doc);
      } else {
        const act = activityMap.get(doc.session_id);
        const date = act?.scheduled_date ?? 'unknown';
        const arr = byDate.get(date) ?? [];
        arr.push(doc);
        byDate.set(date, arr);
      }
    }

    const groups: IndexGroup[] = [];
    if (general.length > 0) {
      groups.push({ label: t('documents.index.generalGroup', { count: general.length }), date: null, docs: general });
    }

    const sortedDates = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    sortedDates.forEach(([date, docs], i) => {
      const formatted = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
      groups.push({
        label: t('documents.index.dayGroup', { day: i + 1, date: formatted, count: docs.length }),
        date,
        docs,
      });
    });

    const totalSize = documents.reduce((s, d) => s + (d.file_size ?? 0), 0);
    return { groups, totalSize };
  }, [documents, activityMap, t]);

  const buildIndexRows = () => {
    let num = 0;
    const rows: { n: number; title: string; type: string; size: string; session: string; group: string }[] = [];
    for (const g of groups) {
      for (const doc of g.docs) {
        num++;
        rows.push({
          n: num,
          title: doc.title,
          type: (doc.file_type ?? '').toUpperCase(),
          size: formatSize(doc.file_size),
          session: doc.session_title ?? '',
          group: g.label,
        });
      }
    }
    return rows;
  };

  const handleExportExcel = () => {
    const rows = buildIndexRows();
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      '#': r.n,
      'Título': r.title,
      'Tipo': r.type,
      'Tamaño': r.size,
      'Sesión': r.session,
      'Sección': r.group,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Índice');
    XLSX.writeFile(wb, `indice-documentos-${event?.event_code ?? 'export'}.xlsx`);
  };

  const handleExportText = () => {
    const lines: string[] = [];
    lines.push(`ÍNDICE DE DOCUMENTOS — ${event?.name ?? ''}`);
    lines.push(`Generado: ${new Date().toLocaleDateString('es-ES')}`);
    lines.push('');

    let num = 0;
    for (const g of groups) {
      lines.push(g.label.toUpperCase());
      for (const doc of g.docs) {
        num++;
        const line = `  ${num}. ${doc.title} — ${(doc.file_type ?? '').toUpperCase()} — ${formatSize(doc.file_size)}`;
        lines.push(line);
        if (doc.session_title) lines.push(`     Sesión: ${doc.session_title}`);
      }
      lines.push('');
    }
    lines.push(`TOTAL: ${documents.length} documentos | ${formatSize(totalSize)}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indice-documentos-${event?.event_code ?? 'export'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('documents.index.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-xs text-muted-foreground mb-4">
          <p className="font-semibold text-sm text-foreground">{t('documents.index.header', { name: event?.name ?? '' })}</p>
          <p>{t('documents.index.generated', { date: new Date().toLocaleDateString('es-ES') })}</p>
        </div>

        <div className="space-y-4">
          {groups.map((g, gi) => {
            let globalStart = 0;
            for (let i = 0; i < gi; i++) globalStart += groups[i].docs.length;

            return (
              <div key={gi}>
                <h3 className="font-semibold text-sm text-foreground border-b border-border pb-1 mb-2">{g.label}</h3>
                <div className="space-y-2 pl-2">
                  {g.docs.map((doc, di) => (
                    <div key={doc.id} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground font-mono text-xs w-6 text-right shrink-0">{globalStart + di + 1}.</span>
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{doc.title}</span>
                        <span className="text-muted-foreground"> — {(doc.file_type ?? '').toUpperCase()} — {formatSize(doc.file_size)}</span>
                        {doc.session_title && (
                          <p className="text-xs text-muted-foreground mt-0.5">Sesión: {doc.session_title}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-sm font-semibold text-foreground">
            TOTAL: {documents.length} {t('documents.index.docsLabel')} | {formatSize(totalSize)}
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={handleExportText}>
            <Download className="mr-1 h-4 w-4" />
            {t('documents.index.exportPdf')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="mr-1 h-4 w-4" />
            {t('documents.index.exportExcel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
