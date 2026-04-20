import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { exportAgendaToExcel } from '@/services/admin-agenda-excel.service';
import {
  useAdminActivities,
  useAdminArchivedActivities,
  useAdminInterestCounts,
  useAdminCheckinCounts,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useDuplicateSession,
  useDuplicateDay,
  useArchiveSession,
  useRestoreSession,
  useReorderSessions,
} from '@/hooks/useAdminAgenda';
import type { SessionFormData } from '@/services/admin-agenda.service';
import type { EventActivity, ActivityType } from '@/types';
import { DaySelector } from '@/components/attendee/DaySelector';
import { SessionModal } from '@/components/admin/agenda/SessionModal';
import { SessionDetailDrawer } from '@/components/admin/agenda/SessionDetailDrawer';
import { ImportAgendaModal } from '@/components/admin/agenda/ImportAgendaModal';
import { SortableSessionRow } from '@/components/admin/agenda/SortableSessionRow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, CopyPlus, Upload, RefreshCw, ArchiveRestore, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

const TYPE_COLORS: Record<string, string> = {
  talk: '#1A56A0',
  workshop: '#00B89F',
  other: '#F59E0B',
  ceremony: '#8B5CF6',
  symposium: '#EC4899',
  conference_day: '#6366F1',
  networking: '#14B8A6',
};

export default function AdminAgenda() {
  const { t, i18n } = useTranslation('admin');
  const { event } = useEvent();
  const eventId = event?.id;

  const activitiesQuery = useAdminActivities(eventId);
  const { data: activities, isLoading, isFetching, grouped, sortedDates, rooms, refetch } = activitiesQuery;
  const { data: archived = [], refetch: refetchArchived } = useAdminArchivedActivities(eventId);
  const { data: interestMap, refetch: refetchInterests } = useAdminInterestCounts(eventId);
  const { data: checkinMap, refetch: refetchCheckins } = useAdminCheckinCounts(eventId);

  const createMutation = useCreateSession(eventId);
  const updateMutation = useUpdateSession(eventId);
  const deleteMutation = useDeleteSession(eventId);
  const duplicateMutation = useDuplicateSession(eventId);
  const duplicateDayMutation = useDuplicateDay(eventId);
  const archiveMutation = useArchiveSession(eventId);
  const restoreMutation = useRestoreSession(eventId);
  const reorderMutation = useReorderSessions(eventId);

  const [view, setView] = useState<'active' | 'archived'>('active');
  const [selectedDate, setSelectedDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<EventActivity | null>(null);
  const [detailSession, setDetailSession] = useState<EventActivity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventActivity | null>(null);
  const [duplicateDayOpen, setDuplicateDayOpen] = useState(false);
  const [dupFrom, setDupFrom] = useState('');
  const [dupTo, setDupTo] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const qc = useQueryClient();

  const locale = i18n.language.startsWith('es') ? es : enUS;
  const refreshing = isFetching && !isLoading;

  if (sortedDates.length > 0 && !selectedDate) {
    setSelectedDate(sortedDates[0]);
  }

  const baseSessions = grouped.get(selectedDate) ?? [];
  const sessionsForDay = orderedIds
    ? [...baseSessions].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id))
    : baseSessions;

  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    const form: SessionFormData = {
      title: data.title as string,
      activity_type: data.activity_type as ActivityType,
      scheduled_date: data.scheduled_date as string,
      start_time: data.start_time as string,
      end_time: data.end_time as string,
      location: data.location as string,
      speaker_name: data.speaker_name as string,
      speaker_bio: data.speaker_bio as string,
      description: data.description as string,
      requires_checkin: data.requires_checkin as boolean,
      capacity: (data.capacity as string) ? parseInt(data.capacity as string) : null,
      speaker_photo_url: (data.speaker_photo_url as string | null) ?? null,
      status: (data.is_cancelled as boolean) ? 'cancelled' : null,
    };

    try {
      if (editSession) {
        await updateMutation.mutateAsync({ sessionId: editSession.id, form });
      } else {
        await createMutation.mutateAsync(form);
      }
      toast.success(t('agenda.saveSuccess'));
      setModalOpen(false);
      setEditSession(null);
    } catch {
      toast.error(t('agenda.saveError'));
    }
  }, [editSession, updateMutation, createMutation, t]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(t('agenda.deleteSuccess'));
    } catch {
      toast.error(t('agenda.deleteError'));
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation, t]);

  const handleArchive = useCallback(async (session: EventActivity) => {
    try {
      await archiveMutation.mutateAsync(session.id);
      toast.success(t('agenda.archiveSuccess'), {
        action: {
          label: t('agenda.undo'),
          onClick: () => restoreMutation.mutate(session.id),
        },
      });
    } catch {
      toast.error(t('agenda.archiveError'));
    }
  }, [archiveMutation, restoreMutation, t]);

  const handleRestore = useCallback(async (session: EventActivity) => {
    try {
      await restoreMutation.mutateAsync(session.id);
      toast.success(t('agenda.restoreSuccess'));
    } catch {
      toast.error(t('agenda.restoreError'));
    }
  }, [restoreMutation, t]);

  const handleDuplicate = useCallback(async (session: EventActivity) => {
    try {
      await duplicateMutation.mutateAsync(session);
      toast.success(t('agenda.duplicateSuccess'));
    } catch {
      toast.error(t('agenda.duplicateError'));
    }
  }, [duplicateMutation, t]);

  const handleDuplicateDay = useCallback(async () => {
    if (!dupFrom || !dupTo) return;
    try {
      const count = await duplicateDayMutation.mutateAsync({ fromDate: dupFrom, toDate: dupTo });
      toast.success(t('agenda.duplicateDaySuccess', { count }));
      setDuplicateDayOpen(false);
    } catch {
      toast.error(t('agenda.duplicateDayError'));
    }
  }, [dupFrom, dupTo, duplicateDayMutation, t]);

  const handleExport = useCallback(() => {
    if (!activities || activities.length === 0) return;
    void exportAgendaToExcel(activities, event?.name ?? 'agenda');
  }, [activities, event]);

  const handleRefreshAll = useCallback(() => {
    void Promise.all([refetch(), refetchInterests(), refetchCheckins(), refetchArchived()]);
  }, [refetch, refetchInterests, refetchCheckins, refetchArchived]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sessionsForDay.findIndex((s) => s.id === active.id);
    const newIndex = sessionsForDay.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(sessionsForDay, oldIndex, newIndex);
    setOrderedIds(newOrder.map((s) => s.id));
    const updates = newOrder.map((s, i) => ({ id: s.id, sort_order: i }));
    reorderMutation.mutate(updates, {
      onSettled: () => setOrderedIds(null),
    });
  };

  const showArchived = view === 'archived';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('agenda.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleRefreshAll} disabled={refreshing}>
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('agenda.refresh')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-1 h-4 w-4" />
                {t('agenda.exportAgenda')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('agenda.exportAgenda')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1 h-4 w-4" />
                {t('agenda.importAgenda')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('agenda.importAgenda')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => { setDuplicateDayOpen(true); setDupFrom(selectedDate); setDupTo(''); }}>
                <CopyPlus className="mr-1 h-4 w-4" />
                {t('agenda.duplicateDay')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('agenda.duplicateDay')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={() => { setEditSession(null); setModalOpen(true); }} style={{ backgroundColor: '#1A56A0' }}>
                <Plus className="mr-1 h-4 w-4" />
                {t('agenda.newSession')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('agenda.newSession')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Active / Archived tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'active' | 'archived')}>
        <TabsList>
          <TabsTrigger value="active">
            {t('agenda.tabActive')} <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{activities?.length ?? 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="archived">
            {t('agenda.tabArchived')} <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{archived.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {!showArchived && sortedDates.length > 0 && (
        <DaySelector dates={sortedDates} selectedDate={selectedDate} onSelect={setSelectedDate} />
      )}

      {/* Refetching overlay wrapper */}
      <div className="relative">
        {refreshing && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/40 backdrop-blur-[1px] animate-fade-in">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <div className={cn('transition-opacity', refreshing && 'opacity-60')}>
          {showArchived ? (
            archived.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">{t('agenda.noArchived')}</p>
            ) : (
              <div className="space-y-2 animate-fade-in">
                {archived.map((s) => {
                  const typeColor = TYPE_COLORS[s.activity_type ?? 'other'] ?? '#94A3B8';
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                      style={{ borderLeft: `4px solid ${typeColor}`, opacity: 0.7 }}
                    >
                      <div className="min-w-[70px] text-sm">
                        <p className="font-bold text-foreground">{s.start_time?.slice(0, 5)}</p>
                        <p className="text-muted-foreground text-xs">{s.scheduled_date}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{s.title}</p>
                        {s.location && <Badge variant="secondary" className="text-xs mt-1">{s.location}</Badge>}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => handleRestore(s)}>
                            <ArchiveRestore className="mr-1 h-4 w-4" />
                            {t('agenda.restore')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('agenda.restore')}</TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            )
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : sessionsForDay.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">{t('agenda.noSessions')}</p>
          ) : (
            <div key={selectedDate} className="animate-fade-in">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sessionsForDay.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {sessionsForDay.map((session) => {
                      const typeColor = TYPE_COLORS[session.activity_type ?? 'other'] ?? '#94A3B8';
                      const interests = interestMap?.get(session.id) ?? 0;
                      const checkins = checkinMap?.get(session.id) ?? 0;
                      return (
                        <SortableSessionRow
                          key={session.id}
                          session={session}
                          typeColor={typeColor}
                          interests={interests}
                          checkins={checkins}
                          onClick={() => setDetailSession(session)}
                          onEdit={() => { setEditSession(session); setModalOpen(true); }}
                          onDuplicate={() => handleDuplicate(session)}
                          onArchive={() => handleArchive(session)}
                          onDelete={() => setDeleteTarget(session)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      <SessionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditSession(null); }}
        onSave={handleSave}
        session={editSession}
        isPending={createMutation.isPending || updateMutation.isPending}
        rooms={rooms}
        defaultDate={selectedDate}
        eventId={eventId}
      />

      <SessionDetailDrawer
        session={detailSession}
        open={!!detailSession}
        onClose={() => setDetailSession(null)}
        interestCount={interestMap?.get(detailSession?.id ?? '') ?? 0}
        checkinCount={checkinMap?.get(detailSession?.id ?? '') ?? 0}
        eventId={eventId ?? ''}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('agenda.deleteSession')}</AlertDialogTitle>
            <AlertDialogDescription>{t('agenda.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('attendees.deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t('attendees.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicateDayOpen} onOpenChange={setDuplicateDayOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('agenda.duplicateDay')}</AlertDialogTitle>
            <AlertDialogDescription>{t('agenda.duplicateDayFrom')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Select value={dupFrom} onValueChange={setDupFrom}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sortedDates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {format(parseISO(d), 'd MMM yyyy', { locale })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{t('agenda.duplicateDayTo')}</p>
            <input
              type="date"
              value={dupTo}
              onChange={(e) => setDupTo(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('attendees.deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDuplicateDay}
              disabled={!dupFrom || !dupTo || duplicateDayMutation.isPending}
              style={{ backgroundColor: '#1A56A0' }}
            >
              {t('agenda.duplicateDay')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportAgendaModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        eventId={eventId ?? ''}
        onImported={() => qc.invalidateQueries({ queryKey: ['admin-activities', eventId] })}
      />
    </div>
  );
}
