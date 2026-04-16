import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserPlus, Upload, Download, Search, X, RefreshCw, Mail, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useAdminAttendees, useSendInvitations, useDeleteAttendee } from '@/hooks/useAdminAttendees';
import { adminAttendeesService, type AttendeeWithServices } from '@/services/admin-attendees.service';
import { useEvent } from '@/hooks/useEvent';
import { writeExcelFile } from '@/lib/excel';
import { AttendeesTable } from '@/components/admin/attendees/AttendeesTable';
import { NewAttendeeModal } from '@/components/admin/attendees/NewAttendeeModal';
import { ImportCsvModal } from '@/components/admin/attendees/ImportCsvModal';
import { AttendeeDetailDrawer } from '@/components/admin/attendees/AttendeeDetailDrawer';
import { DeleteAttendeeDialog } from '@/components/admin/attendees/DeleteAttendeeDialog';
import { DataQualityPanel } from '@/components/admin/attendees/DataQualityPanel';
import { cn } from '@/lib/utils';

export default function AdminAttendees() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [editAttendee, setEditAttendee] = useState<AttendeeWithServices | null>(null);
  const [deleteAttendee, setDeleteAttendee] = useState<{ id: string; name: string } | null>(null);
  const [qualityFilterIds, setQualityFilterIds] = useState<string[] | null>(null);
  const [qualityFilterLabel, setQualityFilterLabel] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { attendees, isLoading, isRefetching, counts, isCountsLoading, refetch } = useAdminAttendees(debouncedSearch, statusFilter);
  const sendInvitationsMutation = useSendInvitations();
  const deleteMutation = useDeleteAttendee();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleRefresh = () => {
    refetch();
    toast({ title: t('attendees.refreshed'), duration: 1500 });
  };

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

  const handleQualityFilter = (ids: string[], label: string) => {
    setQualityFilterIds(ids);
    setQualityFilterLabel(label);
  };

  const clearQualityFilter = () => {
    setQualityFilterIds(null);
    setQualityFilterLabel('');
  };

  const handleBulkSendCredentials = async () => {
    if (selectedIds.size === 0 || !event?.id) return;
    try {
      const result = await sendInvitationsMutation.mutateAsync(Array.from(selectedIds));
      toast({
        title: t('attendees.bulkSendSuccess', { count: result.sent }),
        description: result.failed > 0 ? t('attendees.bulkSendFailed', { count: result.failed }) : undefined,
      });
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

  const handleOpenEditModal = (attendee: AttendeeWithServices) => {
    setEditAttendee(attendee);
    setShowNewModal(true);
  };

  const handleCloseModal = (open: boolean) => {
    setShowNewModal(open);
    if (!open) setEditAttendee(null);
  };

  // Apply quality filter client-side
  const displayedAttendees = qualityFilterIds
    ? attendees.filter((a) => qualityFilterIds.includes(a.id))
    : attendees;

  const statCards = [
    { label: t('attendees.totalRegistered'), value: counts.total, color: 'text-primary' },
    { label: t('attendees.confirmed'), value: counts.confirmed, color: 'text-accent' },
    { label: t('attendees.pending'), value: counts.pending, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('attendees.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} title={t('attendees.refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
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
            <button onClick={clearQualityFilter}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="space-y-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">
              {t('attendees.filterAll')} <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{counts.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="confirmed">
              {t('attendees.filterConfirmed')} <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{counts.confirmed}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending">
              {t('attendees.filterPending')} <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{counts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              {t('attendees.filterCancelled')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('attendees.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {t('attendees.selectedCount', { count: selectedIds.size })}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkSendCredentials}
              disabled={sendInvitationsMutation.isPending}
            >
              <Mail className="mr-2 h-3.5 w-3.5" />
              {sendInvitationsMutation.isPending ? t('attendees.sendingInvitation') : t('attendees.bulkSendCredentials')}
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
      <AttendeesTable
        attendees={displayedAttendees}
        isLoading={isLoading}
        onView={(id) => setSelectedAttendeeId(id)}
        onEdit={handleOpenEditModal}
        onDelete={(id, name) => setDeleteAttendee({ id, name })}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Modals */}
      <NewAttendeeModal
        key={editAttendee?.id ?? 'new'}
        open={showNewModal}
        onOpenChange={handleCloseModal}
        attendee={editAttendee}
      />
      <ImportCsvModal open={showImportModal} onOpenChange={setShowImportModal} />
      <AttendeeDetailDrawer
        attendeeId={selectedAttendeeId}
        onClose={() => setSelectedAttendeeId(null)}
      />
      <DeleteAttendeeDialog
        attendee={deleteAttendee}
        onClose={() => setDeleteAttendee(null)}
      />
    </div>
  );
}
