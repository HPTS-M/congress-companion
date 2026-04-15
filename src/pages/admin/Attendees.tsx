import { AttendeeDetailDrawer } from '@/components/admin/attendees/AttendeeDetailDrawer';
import { AttendeesTable } from '@/components/admin/attendees/AttendeesTable';
import { DataQualityPanel } from '@/components/admin/attendees/DataQualityPanel';
import { DeleteAttendeeDialog } from '@/components/admin/attendees/DeleteAttendeeDialog';
import { ImportCsvModal } from '@/components/admin/attendees/ImportCsvModal';
import { NewAttendeeModal } from '@/components/admin/attendees/NewAttendeeModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useAdminAttendees } from '@/hooks/useAdminAttendees';
import { useEvent } from '@/hooks/useEvent';
import { writeExcelFile } from '@/lib/excel';
import { adminAttendeesService } from '@/services/admin-attendees.service';
import { Download, Search, Upload, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function AdminAttendees() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingAttendeeId, setEditingAttendeeId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [deleteAttendee, setDeleteAttendee] = useState<{ id: string; name: string } | null>(null);
  const [qualityFilterIds, setQualityFilterIds] = useState<string[] | null>(null);
  const [qualityFilterLabel, setQualityFilterLabel] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { attendees, isLoading, counts, isCountsLoading } = useAdminAttendees(debouncedSearch, statusFilter);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timer);
  }, []);

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
          <Button variant="outline" onClick={handleExportExcel} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? t('attendees.exporting') : t('attendees.exportCsv')}
          </Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t('attendees.importCsv')}
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowNewModal(true)}>
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

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('attendees.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('attendees.filterAll')}</SelectItem>
            <SelectItem value="confirmed">{t('attendees.filterConfirmed')}</SelectItem>
            <SelectItem value="pending">{t('attendees.filterPending')}</SelectItem>
            <SelectItem value="cancelled">{t('attendees.filterCancelled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <AttendeesTable
        attendees={displayedAttendees}
        isLoading={isLoading}
        onView={(id) => setSelectedAttendeeId(id)}
        onEdit={(id) => setEditingAttendeeId(id)}
        onDelete={(id, name) => setDeleteAttendee({ id, name })}
      />

      {/* Modals */}
      <NewAttendeeModal
        open={showNewModal || editingAttendeeId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewModal(false);
            setEditingAttendeeId(null);
          }
        }}
        attendeeId={editingAttendeeId}
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
