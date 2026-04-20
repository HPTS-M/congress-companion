import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { useAdminSponsors } from '@/hooks/useAdminSponsors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, Eye, Mail, MessageCircle, Building2, Award, Trophy, Medal, Download, Upload, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { SponsorModal } from '@/components/admin/sponsors/SponsorModal';
import { SponsorDetailDrawer } from '@/components/admin/sponsors/SponsorDetailDrawer';
import { ImportSponsorsModal } from '@/components/admin/sponsors/ImportSponsorsModal';
import { exportSponsorsToExcel } from '@/services/admin-sponsors-excel.service';
import type { SponsorRow } from '@/services/admin-sponsors.service';
import { usePagination } from '@/hooks/usePagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const LEVEL_COLORS: Record<string, string> = {
  gold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  silver: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  bronze: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  exhibitor: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

const LEVEL_LABELS: Record<string, string> = {
  gold: 'Oro', silver: 'Plata', bronze: 'Bronce', exhibitor: 'Expositor',
};

export default function AdminSponsors() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const { sponsors, isLoading, isFetching, refetch, deleteSponsor } = useAdminSponsors(event?.id);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<SponsorRow | null>(null);
  const [viewingSponsor, setViewingSponsor] = useState<SponsorRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return sponsors;
    const q = search.toLowerCase();
    return sponsors.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.stand_location ?? '').toLowerCase().includes(q) ||
      (s.contact_email ?? '').toLowerCase().includes(q)
    );
  }, [sponsors, search]);

  const pagination = usePagination(filtered, 10);

  const stats = useMemo(() => ({
    total: sponsors.length,
    gold: sponsors.filter((s) => s.level === 'gold').length,
    silver: sponsors.filter((s) => s.level === 'silver').length,
    bronzeExhibitor: sponsors.filter((s) => s.level === 'bronze' || s.level === 'exhibitor').length,
  }), [sponsors]);

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    try {
      await deleteSponsor(deletingId);
      toast.success(t('sponsors.deleteSuccess'));
    } catch {
      toast.error(t('sponsors.deleteError'));
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, deleteSponsor, t]);

  const handleEdit = useCallback((s: SponsorRow) => {
    setEditingSponsor(s);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingSponsor(null);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">{t('sponsors.title')}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            title={t('sponsors.refresh')}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> {t('sponsors.importButton')}
          </Button>
          <Button variant="outline" onClick={async () => {
            try {
              await exportSponsorsToExcel(sponsors, event?.name ?? 'event');
              toast.success(t('sponsors.exportSuccess'));
            } catch {
              toast.error(t('sponsors.exportError'));
            }
          }}>
            <Download className="mr-1 h-4 w-4" /> {t('sponsors.exportButton')}
          </Button>
          <Button onClick={() => setModalOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" /> {t('sponsors.newSponsor')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <Building2 className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">{t('sponsors.statTotal')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Trophy className="mx-auto h-5 w-5 text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.gold}</p>
          <p className="text-xs text-muted-foreground">{t('sponsors.statGold')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Award className="mx-auto h-5 w-5 text-slate-400 mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.silver}</p>
          <p className="text-xs text-muted-foreground">{t('sponsors.statSilver')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Medal className="mx-auto h-5 w-5 text-orange-600 mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.bronzeExhibitor}</p>
          <p className="text-xs text-muted-foreground">{t('sponsors.statBronze')}</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sponsors.searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('sponsors.colSponsor')}</TableHead>
              <TableHead>{t('sponsors.colLevel')}</TableHead>
              <TableHead>{t('sponsors.colCategory')}</TableHead>
              <TableHead>{t('sponsors.colStand')}</TableHead>
              <TableHead>{t('sponsors.colContact')}</TableHead>
              <TableHead className="text-right">{t('sponsors.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('sponsors.noSponsors')}
                </TableCell>
              </TableRow>
            ) : pagination.paginatedItems.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {initials(s.name)}
                    </div>
                    <span className="font-medium text-foreground">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={LEVEL_COLORS[s.level]}>{LEVEL_LABELS[s.level] ?? s.level}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{t(`sponsors.cat_${s.category}`)}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.stand_location ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {s.contact_email && <Mail className="h-4 w-4 text-muted-foreground" />}
                    {s.whatsapp && <MessageCircle className="h-4 w-4 text-muted-foreground" />}
                    {!s.contact_email && !s.whatsapp && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewingSponsor(s)} title={t('sponsors.view')}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(s)} title={t('sponsors.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(s.id)} title={t('sponsors.delete')} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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

      {/* Modal */}
      {modalOpen && event && (
        <SponsorModal
          open={modalOpen}
          onClose={handleCloseModal}
          eventId={event.id}
          sponsor={editingSponsor}
          onSaved={handleCloseModal}
        />
      )}

      {/* Detail drawer */}
      <SponsorDetailDrawer
        open={!!viewingSponsor}
        onClose={() => setViewingSponsor(null)}
        sponsor={viewingSponsor}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sponsors.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('sponsors.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sponsors.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('sponsors.deleteButton')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import modal */}
      {importOpen && event && (
        <ImportSponsorsModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          eventId={event.id}
          onImported={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
