import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { exportAgendaToExcel } from '@/services/admin-agenda-excel.service';
import {
  useAdminActivities,
  useAdminInterestCounts,
  useAdminCheckinCounts,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useDuplicateSession,
  useDuplicateDay,
} from '@/hooks/useAdminAgenda';
import type { SessionFormData } from '@/services/admin-agenda.service';
import type { EventActivity, ActivityType } from '@/types';
import { DaySelector } from '@/components/attendee/DaySelector';
import { SessionModal } from '@/components/admin/agenda/SessionModal';
import { SessionDetailDrawer } from '@/components/admin/agenda/SessionDetailDrawer';
import { ImportAgendaModal } from '@/components/admin/agenda/ImportAgendaModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Copy, Star, Users, Download, CopyPlus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';

const TYPE_COLORS: Record<string, string> = {
  talk: '#1A56A0',
  workshop: '#00B89F',
  other: '#F59E0B',
  ceremony: '#8B5CF6',
  symposium: '#EC4899',
  conference_day: '#6366F1',
  networking: '#14B8A6',
};

const TYPE_LABEL_KEYS: Record<string, string> = {
  talk: 'typeTalk',
  workshop: 'typeWorkshop',
  ceremony: 'typeCeremony',
  other: 'typeOther',
  symposium: 'typeSymposium',
  conference_day: 'typeConferenceDay',
  networking: 'typeNetworking',
};

export default function AdminAgenda() {
  const { t, i18n } = useTranslation('admin');
  const { event } = useEvent();
  const eventId = event?.id;

  const { data: activities, isLoading, grouped, sortedDates, rooms } = useAdminActivities(eventId);
  const { data: interestMap } = useAdminInterestCounts(eventId);
  const { data: checkinMap } = useAdminCheckinCounts(eventId);

  const createMutation = useCreateSession(eventId);
  const updateMutation = useUpdateSession(eventId);
  const deleteMutation = useDeleteSession(eventId);
  const duplicateMutation = useDuplicateSession(eventId);
  const duplicateDayMutation = useDuplicateDay(eventId);

  const [selectedDate, setSelectedDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<EventActivity | null>(null);
  const [detailSession, setDetailSession] = useState<EventActivity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventActivity | null>(null);
  const [duplicateDayOpen, setDuplicateDayOpen] = useState(false);
  const [dupFrom, setDupFrom] = useState('');
  const [dupTo, setDupTo] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const qc = useQueryClient();

  const locale = i18n.language.startsWith('es') ? es : enUS;

  // Auto-select first date
  if (sortedDates.length > 0 && !selectedDate) {
    setSelectedDate(sortedDates[0]);
  }

  const sessionsForDay = grouped.get(selectedDate) ?? [];

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
    exportAgendaToExcel(activities, event?.name ?? 'agenda');
  }, [activities, event]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('agenda.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            {t('agenda.exportAgenda')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />
            {t('agenda.importAgenda')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setDuplicateDayOpen(true); setDupFrom(selectedDate); setDupTo(''); }}>
            <CopyPlus className="mr-1 h-4 w-4" />
            {t('agenda.duplicateDay')}
          </Button>
          <Button size="sm" onClick={() => { setEditSession(null); setModalOpen(true); }} style={{ backgroundColor: '#1A56A0' }}>
            <Plus className="mr-1 h-4 w-4" />
            {t('agenda.newSession')}
          </Button>
        </div>
      </div>

      {/* Day Selector */}
      {sortedDates.length > 0 && (
        <DaySelector dates={sortedDates} selectedDate={selectedDate} onSelect={setSelectedDate} />
      )}

      {/* Session list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : sessionsForDay.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t('agenda.noSessions')}</p>
      ) : (
        <div className="space-y-2">
          {sessionsForDay.map((session) => {
            const typeColor = TYPE_COLORS[session.activity_type ?? 'other'] ?? '#94A3B8';
            const interests = interestMap?.get(session.id) ?? 0;
            const checkins = checkinMap?.get(session.id) ?? 0;

            return (
              <div
                key={session.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                style={{ borderLeft: `4px solid ${typeColor}` }}
                onClick={() => setDetailSession(session)}
              >
                {/* Time */}
                <div className="min-w-[70px] text-sm">
                  <p className="font-bold text-foreground">{session.start_time?.slice(0, 5)}</p>
                  <p className="text-muted-foreground text-xs">{session.end_time?.slice(0, 5)}</p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{session.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {session.location && (
                      <Badge variant="secondary" className="text-xs">{session.location}</Badge>
                    )}
                    {session.speaker_name && (
                      <span className="text-xs text-muted-foreground">{session.speaker_name}</span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    {interests}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[hsl(168,76%,36%)]" />
                    {checkins}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditSession(session); setModalOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(session)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(session)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Session Modal */}
      <SessionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditSession(null); }}
        onSave={handleSave}
        session={editSession}
        isPending={createMutation.isPending || updateMutation.isPending}
        rooms={rooms}
        defaultDate={selectedDate}
      />

      {/* Detail Drawer */}
      <SessionDetailDrawer
        session={detailSession}
        open={!!detailSession}
        onClose={() => setDetailSession(null)}
        interestCount={interestMap?.get(detailSession?.id ?? '') ?? 0}
        checkinCount={checkinMap?.get(detailSession?.id ?? '') ?? 0}
        eventId={eventId ?? ''}
      />

      {/* Delete confirm */}
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

      {/* Duplicate Day Dialog */}
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

      {/* Import Modal */}
      <ImportAgendaModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        eventId={eventId ?? ''}
        onImported={() => qc.invalidateQueries({ queryKey: ['admin-activities', eventId] })}
      />
    </div>
  );
}
