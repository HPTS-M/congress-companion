import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import {
  useAdminDocuments,
  useDocumentActivities,
  useDeleteDocument,
  useBulkDeleteDocuments,
} from '@/hooks/useAdminDocuments';
import { adminDocumentsService, type DocumentWithSession } from '@/services/admin-documents.service';
import { UploadDocumentModal } from '@/components/admin/documents/UploadDocumentModal';
import { EditDocumentModal } from '@/components/admin/documents/EditDocumentModal';
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
  Plus, Download, Pencil, Trash2, FileText, Search, File,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  pptx: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  xlsx: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

const TYPE_ICON_COLORS: Record<string, string> = {
  pdf: 'bg-red-500',
  pptx: 'bg-orange-500',
  docx: 'bg-blue-500',
  xlsx: 'bg-green-500',
};

const FILTERS = ['all', 'pdf', 'pptx', 'docx', 'general'] as const;

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDocuments() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const eventId = event?.id;
  const qc = useQueryClient();

  const { data: documents, isLoading } = useAdminDocuments(eventId);
  const { data: activities } = useDocumentActivities(eventId);
  const deleteMutation = useDeleteDocument(eventId);
  const bulkDeleteMutation = useBulkDeleteDocuments(eventId);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentWithSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentWithSession | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!documents) return [];
    return documents.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.title.toLowerCase().includes(q) || (d.session_title ?? '').toLowerCase().includes(q);
      const matchFilter =
        filter === 'all' ||
        (filter === 'general' ? !d.session_id : d.file_type === filter);
      return matchSearch && matchFilter;
    });
  }, [documents, search, filter]);

  // Stats
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
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((d) => d.id)));
    }
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
      window.open(url, '_blank');
      await adminDocumentsService.incrementDownload(doc.id);
    } catch {
      toast.error(t('documents.downloadError'));
    }
  }, [t]);

  const handleExportList = useCallback(() => {
    if (!documents || documents.length === 0) return;
    const headers = ['Título', 'Tipo', 'Sesión', 'Tamaño', 'Fecha'];
    const rows = documents.map((d) => [
      d.title,
      d.file_type ?? '',
      d.session_title ?? 'General',
      formatSize(d.file_size),
      d.created_at ? new Date(d.created_at).toLocaleDateString('es-ES') : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documentos-${event?.event_code ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [documents, event]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin-documents', eventId] });
  }, [qc, eventId]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('documents.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportList}>
            <Download className="mr-1 h-4 w-4" />
            {t('documents.exportList')}
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" />
            {t('documents.uploadButton')}
          </Button>
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

      {/* Filters */}
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
        <div className="flex gap-1">
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

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-muted p-2">
          <span className="text-sm font-medium">{t('documents.selectedCount', { count: selected.size })}</span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
            <Trash2 className="mr-1 h-4 w-4" />
            {t('documents.deleteSelected')}
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t('documents.noDocuments')}</p>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
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
                <TableHead className="text-right">{t('documents.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => {
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditDoc(doc)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(doc)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Upload Modal */}
      <UploadDocumentModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        eventId={eventId ?? ''}
        activities={activities ?? []}
        onUploaded={invalidate}
      />

      {/* Edit Modal */}
      <EditDocumentModal
        open={!!editDoc}
        onClose={() => setEditDoc(null)}
        document={editDoc}
        eventId={eventId ?? ''}
        activities={activities ?? []}
        onUpdated={invalidate}
      />

      {/* Delete confirm */}
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
  );
}
