import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Plus, Eye, Trash2, Users, CalendarClock, Pencil, Send, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useEvent } from '@/hooks/useEvent';
import {
  useAdminAnnouncements,
  useAdminCommsStats,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useResendAnnouncement,
  useCancelScheduled,
  useDeleteAnnouncement,
} from '@/hooks/useAdminCommunications';
import { format } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import type { AdminAnnouncement } from '@/services/admin-communications.service';
import { usePagination } from '@/hooks/usePagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { AnnouncementModal, type AnnouncementSubmit } from '@/components/admin/communications/AnnouncementModal';

function StatCard({ label, value, icon: Icon, loading }: { label: string; value: number | undefined; icon: React.ElementType; loading: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function isScheduled(a: AdminAnnouncement) {
  return !!a.scheduled_for && !a.sent_at;
}

export default function AdminCommunications() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const { toast } = useToast();
  const eventId = event?.id;

  const announcements = useAdminAnnouncements(eventId);
  const stats = useAdminCommsStats(eventId);
  const createMutation = useCreateAnnouncement(eventId);
  const updateMutation = useUpdateAnnouncement(eventId);
  const resendMutation = useResendAnnouncement(eventId);
  const cancelMutation = useCancelScheduled(eventId);
  const deleteMutation = useDeleteAnnouncement(eventId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [duplicateError, setDuplicateError] = useState(false);

  const [viewAnnouncement, setViewAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAnnouncement | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminAnnouncement | null>(null);

  const list = announcements.data ?? [];
  const scheduled = list.filter(isScheduled);
  const sent = list.filter((a) => !!a.sent_at);
  const sentPagination = usePagination(sent, 10);

  const handleSubmit = async (data: AnnouncementSubmit) => {
    setDuplicateError(false);
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          fields: { title: data.title, body: data.body, scheduledFor: data.scheduledFor },
        });
        toast({ title: t('communications.updateSuccess') });
      } else {
        await createMutation.mutateAsync(data);
        toast({
          title: data.scheduledFor
            ? t('communications.scheduleSuccess')
            : t('communications.sendSuccess', { count: stats.attendees.data ?? 0 }),
        });
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_TITLE') {
        setDuplicateError(true);
      } else {
        toast({ title: t('communications.sendError'), variant: 'destructive' });
      }
    }
  };

  const handleResend = async (a: AdminAnnouncement) => {
    try {
      await resendMutation.mutateAsync({ id: a.id, title: a.title, body: a.body });
      toast({ title: t('communications.resendSuccess', { count: stats.attendees.data ?? 0 }) });
    } catch (err: any) {
      if (err?.message === 'NO_CHANGES') {
        toast({ title: t('communications.noChangesToResend'), variant: 'destructive' });
      } else {
        toast({ title: t('communications.sendError'), variant: 'destructive' });
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: t('communications.deleteSuccess') });
    } catch {
      toast({ title: t('communications.deleteError'), variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const handleCancelScheduled = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget.id);
      toast({ title: t('communications.cancelSuccess') });
    } catch {
      toast({ title: t('communications.deleteError'), variant: 'destructive' });
    }
    setCancelTarget(null);
  };

  const openCreate = () => {
    setEditing(null);
    setDuplicateError(false);
    setModalOpen(true);
  };

  const openEdit = (a: AdminAnnouncement) => {
    setEditing(a);
    setDuplicateError(false);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('communications.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('communications.subtitle')}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('communications.newAnnouncement')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('communications.statTotal')} value={stats.total.data} icon={Megaphone} loading={stats.total.isLoading} />
        <StatCard label={t('communications.statToday')} value={stats.today.data} icon={CalendarClock} loading={stats.today.isLoading} />
        <StatCard label={t('communications.statReach')} value={stats.attendees.data} icon={Users} loading={stats.attendees.isLoading} />
      </div>

      {/* Scheduled section */}
      {scheduled.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold">{t('communications.scheduled')}</h2>
              <Badge variant="secondary" className="ml-auto">{scheduled.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('communications.colAnnouncement')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('communications.scheduledForCol')}</TableHead>
                  <TableHead className="text-right">{t('communications.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduled.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-semibold text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{a.body}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {format(new Date(a.scheduled_for!), 'dd MMM yyyy HH:mm', { locale: esLocale })}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title={t('communications.editTitle')}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setCancelTarget(a)} title={t('communications.cancelScheduled')}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sent */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t('communications.sent')}</h2>
            <Badge variant="secondary" className="ml-auto">{sent.length}</Badge>
          </div>
          {announcements.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : sent.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t('communications.noAnnouncements')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('communications.colAnnouncement')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('communications.colSentAt')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('communications.colReach')}</TableHead>
                  <TableHead className="text-right">{t('communications.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sentPagination.paginatedItems.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-semibold text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{a.body}</p>
                      {a.last_edited_at && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t('communications.lastEdited')}: {format(new Date(a.last_edited_at), 'dd MMM HH:mm', { locale: esLocale })}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                      {a.sent_at ? format(new Date(a.sent_at), 'dd MMM yyyy HH:mm', { locale: esLocale }) : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {a.reach_count} {t('communications.attendeesLabel')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewAnnouncement(a)} title={t('communications.view')}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title={t('communications.editTitle')}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResend(a)}
                          disabled={resendMutation.isPending}
                          title={t('communications.resend')}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a)} title={t('communications.delete')}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {sent.length > 0 && (
        <DataTablePagination
          currentPage={sentPagination.currentPage}
          totalPages={sentPagination.totalPages}
          totalItems={sentPagination.totalItems}
          startIndex={sentPagination.startIndex}
          endIndex={sentPagination.endIndex}
          onPageChange={sentPagination.setPage}
        />
      )}

      <AnnouncementModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); setDuplicateError(false); }}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        announcement={editing}
        duplicateError={duplicateError}
        onClearDuplicate={() => setDuplicateError(false)}
      />

      <Dialog open={!!viewAnnouncement} onOpenChange={() => setViewAnnouncement(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewAnnouncement?.title}</DialogTitle>
            <DialogDescription>
              {viewAnnouncement?.sent_at
                ? format(new Date(viewAnnouncement.sent_at), "dd MMM yyyy 'a las' HH:mm", { locale: esLocale })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-foreground whitespace-pre-wrap">{viewAnnouncement?.body}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">
              <Users className="mr-1 h-3 w-3" />
              {viewAnnouncement?.reach_count ?? 0} {t('communications.attendeesLabel')}
            </Badge>
            {viewAnnouncement?.last_edited_at && (
              <Badge variant="outline" className="text-xs">
                {t('communications.lastEdited')}: {format(new Date(viewAnnouncement.last_edited_at), 'dd MMM HH:mm', { locale: esLocale })}
              </Badge>
            )}
            {viewAnnouncement?.last_resent_at && (
              <Badge variant="outline" className="text-xs">
                {t('communications.lastResent')}: {format(new Date(viewAnnouncement.last_resent_at), 'dd MMM HH:mm', { locale: esLocale })}
              </Badge>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('communications.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('communications.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('communications.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t('communications.deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('communications.cancelScheduledTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('communications.cancelScheduledConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('communications.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelScheduled} className="bg-destructive hover:bg-destructive/90">
              {t('communications.cancelScheduled')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
