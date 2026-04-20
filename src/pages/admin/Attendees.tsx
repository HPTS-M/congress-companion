import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Users, UserPlus, Upload, Download, Search, X, RefreshCw, Mail, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAdminAttendees, useSendInvitations, useDeleteAttendee, useUpdateAttendeeStatus, useAttendeeFilterOptions, usePendingInvitations, useFailedInvitations } from '@/hooks/useAdminAttendees';
import { adminAttendeesService, type AttendeeWithServices, type AttendeeFilters } from '@/services/admin-attendees.service';
import { useEvent } from '@/hooks/useEvent';
import { writeExcelFile } from '@/lib/excel';
import { AttendeesTable } from '@/components/admin/attendees/AttendeesTable';
import { AttendeesFilters, type AttendeesFiltersValue } from '@/components/admin/attendees/AttendeesFilters';
import { NewAttendeeModal } from '@/components/admin/attendees/NewAttendeeModal';
import { ImportCsvModal } from '@/components/admin/attendees/ImportCsvModal';
import { DeleteAttendeeDialog } from '@/components/admin/attendees/DeleteAttendeeDialog';
import { DataQualityPanel } from '@/components/admin/attendees/DataQualityPanel';
import { BulkSendCredentialsModal } from '@/components/admin/attendees/BulkSendCredentialsModal';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { usePagination } from '@/hooks/usePagination';
import { cn } from '@/lib/utils';

// Lazy-load drawer (only loaded when an attendee is selected)
const AttendeeDetailDrawer = lazy(() =>
  import('@/components/admin/attendees/AttendeeDetailDrawer').then((m) => ({ default: m.AttendeeDetailDrawer })),
);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

/** Parse comma-separated query param into a string array. */
function parseList(v: string | null): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function AdminAttendees() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------------- URL-driven state ----------------
  const search = searchParams.get('q') ?? '';
  const statusFilter = searchParams.get('status') ?? 'all';
  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get('size')))
    ? Number(searchParams.get('size'))
    : DEFAULT_PAGE_SIZE;

  const filters: AttendeesFiltersValue = useMemo(
    () => ({
      specialties: parseList(searchParams.get('specialties')),
      institutions: parseList(searchParams.get('institutions')),
      hasServices: (searchParams.get('hasServices') as 'yes' | 'no' | null) || null,
    }),
    [searchParams],
  );

  // Convert UI filters → service filters
  const serviceFilters: AttendeeFilters = useMemo(
    () => ({
      specialties: filters.specialties,
      institutions: filters.institutions,
      hasServices: filters.hasServices,
    }),
    [filters],
  );

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Helper: update URL params (immutable patch)
  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSearch = useCallback((v: string) => updateParams({ q: v || null, page: null }), [updateParams]);
  const setStatusFilter = useCallback((v: string) => updateParams({ status: v === 'all' ? null : v, page: null }), [updateParams]);
  const setPageInUrl = useCallback((p: number) => updateParams({ page: p === 1 ? null : String(p) }), [updateParams]);
  const setPageSizeInUrl = useCallback(
    (s: number) => updateParams({ size: s === DEFAULT_PAGE_SIZE ? null : String(s), page: null }),
    [updateParams],
  );

  const setFilters = useCallback(
    (next: AttendeesFiltersValue) => {
      updateParams({
        specialties: next.specialties.length ? next.specialties.join(',') : null,
        institutions: next.institutions.length ? next.institutions.join(',') : null,
        hasServices: next.hasServices,
        page: null,
      });
    },
    [updateParams],
  );

  // ---------------- Local UI state ----------------
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [editAttendee, setEditAttendee] = useState<AttendeeWithServices | null>(null);
  const [deleteAttendee, setDeleteAttendee] = useState<{ id: string; name: string } | null>(null);
  const [toggleActiveTarget, setToggleActiveTarget] = useState<AttendeeWithServices | null>(null);
  const [qualityFilterIds, setQualityFilterIds] = useState<string[] | null>(null);
  const [qualityFilterLabel, setQualityFilterLabel] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  // Persistent across pages — Set of attendee IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  // Snapshot of selected attendees at the moment the bulk-send modal opens.
  // Prevents losing rows when the user changes filters/pages after selecting
  // (selectedIds persists across pages, but `attendees` only holds current view).
  const [bulkSendSnapshot, setBulkSendSnapshot] = useState<AttendeeWithServices[]>([]);

  // ---------------- Data ----------------
  const { attendees, isLoading, isFetching, isRefetching, counts, isCountsLoading, refetch } =
    useAdminAttendees(debouncedSearch, statusFilter, serviceFilters);
  const { data: filterOptions, isLoading: isFilterOptionsLoading } = useAttendeeFilterOptions();
  const sendInvitationsMutation = useSendInvitations();
  const deleteMutation = useDeleteAttendee();
  const updateStatusMutation = useUpdateAttendeeStatus();
  const { data: pendingInvitationIds = [] } = usePendingInvitations();
  const { data: failedInvitationIds = [] } = useFailedInvitations();
  const failedIdsSet = useMemo(() => new Set(failedInvitationIds), [failedInvitationIds]);

  const handleRetryFailedInvitations = useCallback(async () => {
    if (failedInvitationIds.length === 0 || !event?.id) return;
    try {
      const snapshot = await adminAttendeesService.getAttendeesByIds(failedInvitationIds, event.id);
      setBulkSendSnapshot(snapshot);
      setShowBulkSendModal(true);
    } catch {
      toast({ title: t('attendees.invitationFailed'), variant: 'destructive' });
    }
  }, [failedInvitationIds, event?.id, t]);

  const handleRetryPendingInvitations = useCallback(async () => {
    if (pendingInvitationIds.length === 0) return;
    if (!window.confirm(
      t('attendees.retryPendingConfirm', {
        count: pendingInvitationIds.length,
        defaultValue: 'Send credentials to {{count}} attendee(s) without an invitation yet?',
      }),
    )) return;
    try {
      const result = await sendInvitationsMutation.mutateAsync(pendingInvitationIds);
      if (result.failed === 0) {
        toast({ title: t('attendees.bulkSendSuccess', { count: result.sent }) });
      } else {
        toast({
          title: t('attendees.bulkSendPartial', { sent: result.sent, failed: result.failed }),
          description: result.errors?.[0]?.error
            ? t('attendees.bulkSendFirstError', { error: result.errors[0].error })
            : undefined,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: t('attendees.invitationFailed'), variant: 'destructive' });
    }
  }, [pendingInvitationIds, sendInvitationsMutation, t]);

  const handleRefresh = useCallback(() => {
    refetch();
    toast({ title: t('attendees.refreshed'), duration: 1500 });
  }, [refetch, t]);

  const handleExportExcel = async () => {
    if (!event?.id) return;
    setIsExporting(true);
    try {
      const rows = await adminAttendeesService.getExportData(event.id);
      await writeExcelFile({
        filename: `attendees_${event.event_code || 'export'}.xlsx`,
        sheetName: 'Asistentes',
        columns: [
          { header: 'Nombre completo', key: 'full_name', width: 30 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Código credencial', key: 'credential_code', width: 20 },
          { header: 'Especialidad', key: 'specialty', width: 25 },
          { header: 'Institución', key: 'institution', width: 25 },
          { header: 'Estado', key: 'registration_status', width: 15 },
          { header: 'Servicios', key: 'services_count', width: 12 },
          { header: 'Check-ins', key: 'checkins_count', width: 12 },
        ],
        rows: rows as unknown as Record<string, unknown>[],
      });
      toast({ title: t('attendees.exportSuccess') });
    } catch {
      toast({ title: t('attendees.exportError'), variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleQualityFilter = useCallback((ids: string[], label: string) => {
    setQualityFilterIds(ids);
    setQualityFilterLabel(label);
  }, []);

  const clearQualityFilter = useCallback(() => {
    setQualityFilterIds(null);
    setQualityFilterLabel('');
  }, []);

  const handleBulkSendCredentials = async () => {
    if (selectedIds.size === 0 || !event?.id) return;
    // Snapshot selected attendees from the full event dataset (not just the
    // current visible/paginated view) so the modal breakdown is always complete.
    try {
      const ids = Array.from(selectedIds);
      const snapshot = await adminAttendeesService.getAttendeesByIds(ids, event.id);
      setBulkSendSnapshot(snapshot);
      setShowBulkSendModal(true);
    } catch {
      toast({ title: t('attendees.invitationFailed'), variant: 'destructive' });
    }
  };

  const confirmBulkSend = async (validIds: string[]) => {
    if (validIds.length === 0 || !event?.id) return;
    try {
      const result = await sendInvitationsMutation.mutateAsync(validIds);
      if (result.failed === 0) {
        toast({
          title: t('attendees.bulkSendSuccess', { count: result.sent }),
        });
      } else {
        const firstError = result.errors?.[0]?.error;
        toast({
          title: t('attendees.bulkSendPartial', { sent: result.sent, failed: result.failed }),
          description: firstError ? t('attendees.bulkSendFirstError', { error: firstError }) : undefined,
          variant: 'destructive',
        });
      }
      setShowBulkSendModal(false);
      setSelectedIds(new Set());
    } catch {
      toast({ title: t('attendees.invitationFailed'), variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t('attendees.bulkDeleteConfirm', { count: selectedIds.size }))) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteMutation.mutateAsync(id)));
      toast({ title: t('attendees.bulkDeleteSuccess', { count: selectedIds.size }) });
      setSelectedIds(new Set());
    } catch {
      toast({ title: t('attendees.deleteConfirm.error'), variant: 'destructive' });
    }
  };

  const handleOpenEditModal = useCallback((attendee: AttendeeWithServices) => {
    setEditAttendee(attendee);
    setShowNewModal(true);
  }, []);

  const handleCloseModal = useCallback((open: boolean) => {
    setShowNewModal(open);
    if (!open) setEditAttendee(null);
  }, []);

  const handleToggleActive = useCallback((a: AttendeeWithServices) => {
    setToggleActiveTarget(a);
  }, []);

  const confirmToggleActive = async () => {
    if (!toggleActiveTarget) return;
    const isCancelled = toggleActiveTarget.registration_status === 'cancelled';
    const newStatus = isCancelled ? 'pending' : 'cancelled';
    try {
      await updateStatusMutation.mutateAsync({ id: toggleActiveTarget.id, status: newStatus });
      toast({ title: t(isCancelled ? 'attendees.reactivateSuccess' : 'attendees.deactivateSuccess') });
      setToggleActiveTarget(null);
    } catch {
      toast({ title: t('attendees.deactivateError'), variant: 'destructive' });
    }
  };

  // Apply quality filter client-side, memoized
  const displayedAttendees = useMemo(
    () => (qualityFilterIds ? attendees.filter((a) => qualityFilterIds.includes(a.id)) : attendees),
    [attendees, qualityFilterIds],
  );

  // Pagination over the filtered list (URL-driven page + size)
  const {
    paginatedItems,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
  } = usePagination(displayedAttendees, pageSize, {
    controlledPage: currentPage,
    onPageChange: setPageInUrl,
  });

  const statCards = useMemo(() => [
    { label: t('attendees.totalRegistered'), value: counts.total, color: 'text-primary' },
    { label: t('attendees.confirmed'), value: counts.confirmed, color: 'text-accent' },
    { label: t('attendees.pending'), value: counts.pending, color: 'text-amber-500' },
  ], [t, counts]);

  const isCancelledTarget = toggleActiveTarget?.registration_status === 'cancelled';

  const hasAnyFilter =
    !!search ||
    statusFilter !== 'all' ||
    !!qualityFilterIds ||
    filters.specialties.length > 0 ||
    filters.institutions.length > 0 ||
    !!filters.hasServices;

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setFilters({ specialties: [], institutions: [], hasServices: null });
    clearQualityFilter();
  };

  // Visible vs total selection counters
  const visibleSelectedCount = paginatedItems.filter((a) => selectedIds.has(a.id)).length;

  // Select all across the *current filtered dataset* (not just visible page)
  const selectAllFiltered = () => {
    setSelectedIds(new Set(displayedAttendees.map((a) => a.id)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('attendees.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} title={t('attendees.refresh')} disabled={isRefetching}>
            <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
          </Button>
          {pendingInvitationIds.length > 0 && (
            <Button
              variant="outline"
              onClick={handleRetryPendingInvitations}
              disabled={sendInvitationsMutation.isPending}
              className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              title={t('attendees.retryPendingTitle', {
                defaultValue: 'Send credential emails to attendees without an invitation',
              })}
            >
              {sendInvitationsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {t('attendees.retryPendingInvitations', {
                count: pendingInvitationIds.length,
                defaultValue: 'Retry pending ({{count}})',
              })}
            </Button>
          )}
          <Button variant="outline" onClick={handleExportExcel} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? t('attendees.exporting') : t('attendees.exportCsv')}
          </Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t('attendees.importCsv')}
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditAttendee(null); setShowNewModal(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t('attendees.newAttendee')}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className={`h-8 w-8 ${card.color}`} />
              <div>
                {isCountsLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                )}
                <div className="text-xs text-muted-foreground">{card.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data Quality */}
      <DataQualityPanel onFilterByIds={handleQualityFilter} />

      {/* Quality filter indicator */}
      {qualityFilterIds && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            {t('attendees.qualityFilterActive')}: {qualityFilterLabel}
            <button onClick={clearQualityFilter} aria-label={t('attendees.clearFilter')}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Filter bar — sticky-ish on mobile via natural top placement */}
      <div className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
        {/* Status tabs (scrollable on mobile) */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="all" className="flex-col gap-0.5 py-2 sm:flex-row sm:gap-1.5">
              <span className="truncate">{t('attendees.filterAll')}</span>
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] px-1.5">{counts.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="flex-col gap-0.5 py-2 sm:flex-row sm:gap-1.5">
              <span className="truncate">{t('attendees.filterConfirmed')}</span>
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] px-1.5">{counts.confirmed}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-col gap-0.5 py-2 sm:flex-row sm:gap-1.5">
              <span className="truncate">{t('attendees.filterPending')}</span>
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] px-1.5">{counts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="py-2">
              <span className="truncate">{t('attendees.filterCancelled')}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search with loading spinner */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('attendees.searchPlaceholder')}
            className="pl-9 pr-9 h-10"
            aria-label={t('attendees.searchPlaceholder')}
          />
          {(isFetching || search !== debouncedSearch) && search && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {!isFetching && search && search === debouncedSearch && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('attendees.clearFilter')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Advanced filters (specialty / institution / services) */}
        <AttendeesFilters
          value={filters}
          onChange={setFilters}
          options={filterOptions ?? { specialties: [], institutions: [] }}
          isLoading={isFilterOptionsLoading}
        />
      </div>

      {/* Bulk action bar — persistent across pages */}
      {selectedIds.size > 0 && (
        <div
          className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-3 sm:flex-row sm:items-center"
          role="region"
          aria-live="polite"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {t('attendees.selectedCount', { count: selectedIds.size })}
            </span>
            {selectedIds.size > visibleSelectedCount && (
              <span className="text-xs text-muted-foreground">
                {t('attendees.filters.selectionAcrossPages', {
                  visible: visibleSelectedCount,
                  total: selectedIds.size,
                  defaultValue: '{{visible}} on this page · {{total}} total',
                })}
              </span>
            )}
          </div>
          {selectedIds.size < displayedAttendees.length && (
            <Button size="sm" variant="ghost" onClick={selectAllFiltered}>
              {t('attendees.filters.selectAllN', {
                count: displayedAttendees.length,
                defaultValue: 'Select all {{count}}',
              })}
            </Button>
          )}
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkSendCredentials}
              disabled={sendInvitationsMutation.isPending}
            >
              {sendInvitationsMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="mr-2 h-3.5 w-3.5" />
              )}
              {sendInvitationsMutation.isPending
                ? t('attendees.sendingInvitation')
                : `${t('attendees.bulkSendCredentials')} (${selectedIds.size})`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30"
              onClick={handleBulkDelete}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {t('attendees.bulkDelete')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              {t('attendees.clearSelection')}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div key={statusFilter} className="animate-fade-in">
        {!isLoading && displayedAttendees.length === 0 && hasAnyFilter ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-foreground">
              {t('attendees.filters.noResultsTitle', { defaultValue: 'No results' })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('attendees.filters.noResultsHint', {
                defaultValue: 'Try clearing some filters or adjusting your search.',
              })}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={clearAllFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              {t('attendees.filters.clearFiltersBtn', { defaultValue: 'Clear filters' })}
            </Button>
          </div>
        ) : (
          <>
            <AttendeesTable
              attendees={paginatedItems}
              isLoading={isLoading}
              isRefetching={isRefetching}
              onView={setSelectedAttendeeId}
              onEdit={handleOpenEditModal}
              onDelete={(id, name) => setDeleteAttendee({ id, name })}
              onToggleActive={handleToggleActive}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={setPageInUrl}
              pageSize={pageSize}
              onPageSizeChange={setPageSizeInUrl}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </>
        )}
      </div>

      {/* Modals */}
      <NewAttendeeModal
        key={editAttendee?.id ?? 'new'}
        open={showNewModal}
        onOpenChange={handleCloseModal}
        attendee={editAttendee}
      />
      <ImportCsvModal open={showImportModal} onOpenChange={setShowImportModal} />
      {selectedAttendeeId && (
        <Suspense fallback={null}>
          <AttendeeDetailDrawer
            attendeeId={selectedAttendeeId}
            onClose={() => setSelectedAttendeeId(null)}
          />
        </Suspense>
      )}
      <DeleteAttendeeDialog
        attendee={deleteAttendee}
        onClose={() => setDeleteAttendee(null)}
      />

      {/* Bulk send credentials confirmation modal */}
      <BulkSendCredentialsModal
        open={showBulkSendModal}
        onOpenChange={setShowBulkSendModal}
        selectedAttendees={bulkSendSnapshot}
        isSending={sendInvitationsMutation.isPending}
        onConfirm={confirmBulkSend}
      />

      {/* Deactivate / Reactivate confirmation */}
      <AlertDialog open={!!toggleActiveTarget} onOpenChange={(o) => { if (!o) setToggleActiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(isCancelledTarget ? 'attendees.reactivateTitle' : 'attendees.deactivateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(isCancelledTarget ? 'attendees.reactivateConfirm' : 'attendees.deactivateConfirm', {
                name: toggleActiveTarget?.full_name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('attendees.deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleActive}
              className={isCancelledTarget ? 'bg-accent text-accent-foreground' : 'bg-destructive text-destructive-foreground'}
            >
              {t(isCancelledTarget ? 'attendees.reactivate' : 'attendees.deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
