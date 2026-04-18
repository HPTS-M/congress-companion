import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Plus, Eye, Trash2, MessageSquare, Users, CalendarClock, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useEvent } from '@/hooks/useEvent';
import {
  useAdminAnnouncements,
  useAdminCommsStats,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useAdminGroupChat,
  useAdminAttendeeNames,
  useDeleteChatMessage,
} from '@/hooks/useAdminCommunications';
import { format } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import type { AdminAnnouncement, ChatMessageAdmin } from '@/services/admin-communications.service';
import { usePagination } from '@/hooks/usePagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

/* ───── Stat Card ───── */
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

/* ───── Main Component ───── */
export default function AdminCommunications() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const { toast } = useToast();
  const eventId = event?.id;

  // Data
  const announcements = useAdminAnnouncements(eventId);
  const stats = useAdminCommsStats(eventId);
  const createMutation = useCreateAnnouncement(eventId);
  const deleteMutation = useDeleteAnnouncement(eventId);
  const chatMessages = useAdminGroupChat(eventId);
  const attendeeNames = useAdminAttendeeNames(eventId);
  const deleteChatMsg = useDeleteChatMessage(eventId);

  // UI state
  const [showNewModal, setShowNewModal] = useState(false);
  const [viewAnnouncement, setViewAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteChatTarget, setDeleteChatTarget] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const annPagination = usePagination(announcements.data ?? [], 10);
  const chatPagination = usePagination(chatMessages.data ?? [], 10);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    try {
      await createMutation.mutateAsync({ title: newTitle, body: newBody });
      toast({ title: t('communications.sendSuccess', { count: stats.attendees.data ?? 0 }) });
      setShowNewModal(false);
      setNewTitle('');
      setNewBody('');
    } catch {
      toast({ title: t('communications.sendError'), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast({ title: t('communications.deleteSuccess') });
    } catch {
      toast({ title: t('communications.deleteError'), variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const handleDeleteChat = async () => {
    if (!deleteChatTarget) return;
    try {
      await deleteChatMsg.mutateAsync(deleteChatTarget);
      toast({ title: t('communications.chatMessageDeleted') });
    } catch {
      toast({ title: t('communications.chatDeleteError'), variant: 'destructive' });
    }
    setDeleteChatTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('communications.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('communications.subtitle')}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowNewModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('communications.newAnnouncement')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('communications.statTotal')} value={stats.total.data} icon={Megaphone} loading={stats.total.isLoading} />
        <StatCard label={t('communications.statToday')} value={stats.today.data} icon={CalendarClock} loading={stats.today.isLoading} />
        <StatCard label={t('communications.statReach')} value={stats.attendees.data} icon={Users} loading={stats.attendees.isLoading} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="announcements">
        <TabsList>
          <TabsTrigger value="announcements">
            <Megaphone className="mr-2 h-4 w-4" />
            {t('communications.tabAnnouncements')}
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="mr-2 h-4 w-4" />
            {t('communications.tabChat')}
          </TabsTrigger>
        </TabsList>

        {/* ─── Announcements Tab ─── */}
        <TabsContent value="announcements">
          <Card>
            <CardContent className="p-0">
              {announcements.isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !announcements.data?.length ? (
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
                    {annPagination.paginatedItems.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <p className="font-semibold text-foreground">{a.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{a.body}</p>
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
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a.id)} title={t('communications.delete')}>
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
          {(announcements.data?.length ?? 0) > 0 && (
            <div className="mt-2">
              <DataTablePagination
                currentPage={annPagination.currentPage}
                totalPages={annPagination.totalPages}
                totalItems={annPagination.totalItems}
                startIndex={annPagination.startIndex}
                endIndex={annPagination.endIndex}
                onPageChange={annPagination.setPage}
              />
            </div>
          )}
        </TabsContent>

        {/* ─── Chat General Tab ─── */}
        <TabsContent value="chat">
          <Card>
            <CardContent className="p-4">
              {chatMessages.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !chatMessages.data?.length ? (
                <div className="p-8 text-center text-muted-foreground">{t('communications.noMessages')}</div>
              ) : (
                <>
                <div className="space-y-3">
                  {chatPagination.paginatedItems.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {attendeeNames.data?.[msg.sender_id] ?? t('communications.unknownSender')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {msg.created_at ? format(new Date(msg.created_at), 'dd MMM HH:mm', { locale: esLocale }) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{msg.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setDeleteChatTarget(msg.id)}
                        title={t('communications.moderate')}
                      >
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <DataTablePagination
                  currentPage={chatPagination.currentPage}
                  totalPages={chatPagination.totalPages}
                  totalItems={chatPagination.totalItems}
                  startIndex={chatPagination.startIndex}
                  endIndex={chatPagination.endIndex}
                  onPageChange={chatPagination.setPage}
                />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── New Announcement Modal ─── */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('communications.newAnnouncement')}</DialogTitle>
            <DialogDescription>{t('communications.newAnnouncementDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('communications.fieldTitle')}</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('communications.fieldTitlePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('communications.fieldBody')}</Label>
              <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder={t('communications.fieldBodyPlaceholder')} rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>{t('communications.cancel')}</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !newTitle.trim() || !newBody.trim()}>
              {createMutation.isPending ? t('communications.sending') : t('communications.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Announcement Dialog ─── */}
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
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <Users className="mr-1 h-3 w-3" />
              {stats.attendees.data ?? 0} {t('communications.attendeesLabel')}
            </Badge>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Announcement Confirm ─── */}
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

      {/* ─── Delete Chat Message Confirm ─── */}
      <AlertDialog open={!!deleteChatTarget} onOpenChange={() => setDeleteChatTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('communications.moderateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('communications.moderateConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('communications.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChat} className="bg-destructive hover:bg-destructive/90">
              {t('communications.moderateDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
