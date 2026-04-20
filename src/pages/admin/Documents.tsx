import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import {
  useAdminDocuments,
  useDocumentActivities,
  useDeleteDocument,
  useBulkDeleteDocuments,
} from '@/hooks/useAdminDocuments';
import { type DocumentWithSession } from '@/services/admin-documents.service';
import { UploadDocumentModal } from '@/components/admin/documents/UploadDocumentModal';
import { BulkUploadDocumentsModal } from '@/components/admin/documents/BulkUploadDocumentsModal';
import { EditDocumentModal } from '@/components/admin/documents/EditDocumentModal';
import { DocumentIndexModal } from '@/components/admin/documents/DocumentIndexModal';
import { DocumentQualityPanel } from '@/components/admin/documents/DocumentQualityPanel';
import { DocumentPreviewModal } from '@/components/admin/documents/DocumentPreviewModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus, Pencil, Trash2, FileText, Search, List,
  RefreshCw, Eye, UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { usePagination } from '@/hooks/usePagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  pptx: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  xlsx: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  zip: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  png: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  jpg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  mp4: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  txt: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  csv: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
};

const TYPE_ICON_COLORS: Record<string, string> = {
  pdf: 'bg-red-500',
  pptx: 'bg-orange-500',
  docx: 'bg-blue-500',
  xlsx: 'bg-green-500',
  zip: 'bg-slate-500',
  png: 'bg-indigo-500',
  jpg: 'bg-indigo-500',
  mp4: 'bg-pink-500',
  txt: 'bg-slate-500',
  csv: 'bg-emerald-500',
};

const FILTERS = ['all', 'pdf', 'pptx', 'docx', 'general'] as const;

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
}

export default function AdminDocuments() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const eventId = event?.id;
  const qc = useQueryClient();
  const isFetching = useIsFetching({ queryKey: ['admin-documents', eventId] }) > 0;

  const { data: documents, isLoading } = useAdminDocuments(eventId);
  const { data: activities } = useDocumentActivities(eventId);
  const deleteMutation = useDeleteDocument(eventId);
  const bulkDeleteMutation = useBulkDeleteDocuments(eventId);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentWithSession | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentWithSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentWithSession | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [indexOpen, setIndexOpen] = useState(false);
  const [qualityFilterIds, setQualityFilterIds] = useState<string[] | null>(null);
  const [qualityFilterLabel, setQualityFilterLabel] = useState('');

  const filtered = useMemo(() => {
    if (!documents) return [];
    return documents.filter((d) => {
      if (qualityFilterIds) return qualityFilterIds.includes(d.id);
      const q = search.toLowerCase();
      const matchSearch = !q || d.title.toLowerCase().includes(q) || (d.session_title ?? '').toLowerCase().includes(q);
      const matchFilter =
        filter === 'all' ||
        (filter === 'general' ? !d.session_id : d.file_type === filter);
      return matchSearch && matchFilter;
    });
  }, [documents, search, filter, qualityFilterIds]);

  const pagination = usePagination(filtered, 10);

  const stats = useMemo(() => {
    const all = documents ?? [];
    return {
      total: all.length,
      pdfs: all.filter((d) => d.file_type === 'pdf').length,
      presentations: all.filter((d) => d.file_type === 'pptx').length,
    };
  }, [documents]);

  const allSelected = filtered.length > 0 && filtered.every((d) => selected.has(d.id));

  const toggleAll = useCallback(() => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((d) => d.id)));
  }, [allSelected, filtered]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ docId: deleteTarget.id, filePath: deleteTarget.file_path });
      toast.success(t('documents.deleteSuccess'));
    } catch {
      toast.error(t('documents.deleteError'));
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation, t]);

  const handleBulkDelete = useCallback(async () => {
    const docs = (documents ?? []).filter((d) => selected.has(d.id)).map((d) => ({ id: d.id, file_path: d.file_path }));
    if (docs.length === 0) return;
    try {
      await bulkDeleteMutation.mutateAsync(docs);
      toast.success(t('documents.bulkDeleteSuccess', { count: docs.length }));
      setSelected(new Set());
    } catch {
      toast.error(t('documents.deleteError'));
    }
  }, [selected, documents, bulkDeleteMutation, t]);

  const handleDownload = useCallback(async (doc: DocumentWithSession) => {
    try {
      const url = await adminDocumentsService.getSignedUrl(doc.file_path);
      const ext = doc.file_path.split('.').pop() ?? '';
      const filename = sanitizeFilename(doc.title) + (ext ? `.${ext}` : '');
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      await adminDocumentsService.incrementDownload(doc.id);
    } catch {
      toast.error(t('documents.downloadError'));
    }
  }, [t]);

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin-documents', eventId] });
    qc.invalidateQueries({ queryKey: ['admin-doc-activities', eventId] });
    toast.success(t('documents.refreshed'));
  }, [qc, eventId, t]);

  const handleExportXls = useCallback(async () => {
    if (!documents || documents.length === 0) return;
    try {
      await writeExcelFile({
        filename: `documentos-${event?.event_code ?? 'export'}-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: t('documents.title'),
        columns: [
          { header: t('documents.colDocument'), key: 'titulo', width: 40 },
          { header: t('documents.colType'), key: 'tipo', width: 10 },
          { header: t('documents.colSession'), key: 'sesion', width: 30 },
          { header: t('documents.colSize'), key: 'tamano', width: 12 },
          { header: t('documents.colDate'), key: 'fecha', width: 14 },
          { header: t('documents.colDownloads'), key: 'descargas', width: 12 },
        ],
        rows: documents.map((d) => ({
          titulo: d.title,
          tipo: (d.file_type ?? '').toUpperCase(),
          sesion: d.session_title ?? t('documents.generalBadge'),
          tamano: formatSize(d.file_size),
          fecha: d.created_at ? new Date(d.created_at).toLocaleDateString('es-ES') : '',
          descargas: d.download_count ?? 0,
        })),
      });
      toast.success(t('documents.exportSuccess'));
    } catch {
      toast.error(t('documents.exportError'));
    }
  }, [documents, event, t]);

  const handleBulkExportZip = useCallback(async () => {
    if (!documents || documents.length === 0) return;
    const targetDocs = selected.size > 0
      ? documents.filter((d) => selected.has(d.id))
      : documents;

    setBulkExportProgress({ current: 0, total: targetDocs.length });
    try {
      const zip = new JSZip();

      // Build XLSX into the zip via ExcelJS buffer
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t('documents.title'));
      ws.columns = [
        { header: t('documents.colDocument'), key: 'titulo', width: 40 },
        { header: t('documents.colType'), key: 'tipo', width: 10 },
        { header: t('documents.colSession'), key: 'sesion', width: 30 },
        { header: t('documents.colSize'), key: 'tamano', width: 12 },
        { header: t('documents.colDate'), key: 'fecha', width: 14 },
        { header: 'Archivo', key: 'archivo', width: 40 },
      ];
      for (const d of targetDocs) {
        const ext = d.file_path.split('.').pop() ?? '';
        ws.addRow({
          titulo: d.title,
          tipo: (d.file_type ?? '').toUpperCase(),
          sesion: d.session_title ?? t('documents.generalBadge'),
          tamano: formatSize(d.file_size),
          fecha: d.created_at ? new Date(d.created_at).toLocaleDateString('es-ES') : '',
          archivo: `archivos/${sanitizeFilename(d.title)}.${ext}`,
        });
      }
      const xlsxBuffer = await wb.xlsx.writeBuffer();
      zip.file('indice.xlsx', xlsxBuffer);

      // Add files
      let i = 0;
      for (const d of targetDocs) {
        try {
          const blob = await adminDocumentsService.downloadFileBlob(d.file_path);
          const ext = d.file_path.split('.').pop() ?? '';
          const safeName = sanitizeFilename(d.title) + (ext ? `.${ext}` : '');
          zip.file(`archivos/${safeName}`, blob);
        } catch {
          // skip missing files but continue
        }
        i++;
        setBulkExportProgress({ current: i, total: targetDocs.length });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `documentos-${event?.event_code ?? 'export'}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('documents.bulkExportSuccess'));
    } catch {
      toast.error(t('documents.bulkExportError'));
    } finally {
      setBulkExportProgress(null);
    }
  }, [documents, selected, event, t]);

  const handleQualityFilter = useCallback((ids: string[], label: string) => {
    setQualityFilterIds(ids);
    setQualityFilterLabel(label);
  }, []);

  const clearQualityFilter = useCallback(() => {
    setQualityFilterIds(null);
    setQualityFilterLabel('');
  }, []);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin-documents', eventId] });
  }, [qc, eventId]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">{t('documents.title')}</h1>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  {t('documents.refresh')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('documents.tooltip.refresh')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setIndexOpen(true)}>
                  <List className="mr-1 h-4 w-4" />
                  {t('documents.viewIndex')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('documents.tooltip.index')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setCompletenessOpen(true)}>
                  <ClipboardCheck className="mr-1 h-4 w-4" />
                  {t('documents.completenessCheck')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('documents.tooltip.completeness')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleExportXls}>
                  <FileSpreadsheet className="mr-1 h-4 w-4" />
                  {t('documents.exportXls')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('documents.tooltip.exportXls')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExportZip}
                  disabled={!!bulkExportProgress || !documents || documents.length === 0}
                >
                  <Archive className="mr-1 h-4 w-4" />
                  {bulkExportProgress
                    ? t('documents.bulkExporting', { current: bulkExportProgress.current, total: bulkExportProgress.total })
                    : t('documents.bulkExport')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('documents.tooltip.bulkExport')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={() => setUploadOpen(true)} className="bg-primary text-primary-foreground">
                  <Plus className="mr-1 h-4 w-4" />
                  {t('documents.uploadButton')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('documents.tooltip.upload')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('documents.statTotal'), value: stats.total },
            { label: t('documents.statPdfs'), value: stats.pdfs },
            { label: t('documents.statPresentations'), value: stats.presentations },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quality Panel */}
        {documents && documents.length > 0 && (
          <DocumentQualityPanel documents={documents} onFilterByIds={handleQualityFilter} />
        )}

        {qualityFilterIds && (
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              🔍 {qualityFilterLabel} ({qualityFilterIds.length})
            </span>
            <Button variant="outline" size="sm" onClick={clearQualityFilter} className="text-xs h-7">
              {t('documents.quality.clearFilter')}
            </Button>
          </div>
        )}

        {!qualityFilterIds && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('documents.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-primary text-primary-foreground' : ''}
                >
                  {t(`documents.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-muted p-2 flex-wrap">
            <span className="text-sm font-medium">{t('documents.selectedCount', { count: selected.size })}</span>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
              <Trash2 className="mr-1 h-4 w-4" />
              {t('documents.deleteSelected')}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">{t('documents.noDocuments')}</p>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>{t('documents.colDocument')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('documents.colType')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('documents.colSession')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('documents.colSize')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('documents.colDate')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('documents.colDownloads')}</TableHead>
                    <TableHead className="text-right">{t('documents.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((doc) => {
                    const typeClass = TYPE_COLORS[doc.file_type ?? ''] ?? 'bg-muted text-muted-foreground';
                    const iconClass = TYPE_ICON_COLORS[doc.file_type ?? ''] ?? 'bg-muted-foreground';
                    return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Checkbox checked={selected.has(doc.id)} onCheckedChange={() => toggleOne(doc.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconClass}`}>
                              <FileText className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-medium text-sm truncate max-w-[200px]">{doc.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={typeClass}>{(doc.file_type ?? '').toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {doc.session_title ? (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px] block">{doc.session_title}</span>
                          ) : (
                            <Badge variant="secondary">{t('documents.generalBadge')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {formatSize(doc.file_size)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString('es-ES') : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {doc.download_count ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewDoc(doc)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('documents.tooltip.preview')}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('documents.tooltip.download')}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditDoc(doc)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('documents.tooltip.edit')}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(doc)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('documents.tooltip.delete')}</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setPage}
            />
          </div>
        )}

        <UploadDocumentModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          eventId={eventId ?? ''}
          activities={activities ?? []}
          onUploaded={invalidate}
        />

        <EditDocumentModal
          open={!!editDoc}
          onClose={() => setEditDoc(null)}
          document={editDoc}
          eventId={eventId ?? ''}
          activities={activities ?? []}
          onUpdated={invalidate}
        />

        <DocumentIndexModal
          open={indexOpen}
          onClose={() => setIndexOpen(false)}
          documents={documents ?? []}
          activities={activities ?? []}
          event={event}
        />

        <CompletenessCheckModal
          open={completenessOpen}
          onClose={() => setCompletenessOpen(false)}
          documents={documents ?? []}
        />

        <DocumentPreviewModal
          open={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          document={previewDoc}
        />

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('documents.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('documents.deleteConfirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('documents.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                {t('documents.deleteButton')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
