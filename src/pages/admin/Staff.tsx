import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Mail, Pencil, Trash2, Users, Search, CheckCircle2,
} from 'lucide-react';
import { useEvent } from '@/hooks/useEvent';
import {
  useStaffMembers, useCreateStaffMember, useUpdateStaffMember,
  useDeleteStaffMember, useInviteStaffUser, useSetStaffInvitationStatus,
  useToggleStaffActive,
} from '@/hooks/useAdminStaff';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import type { StaffMember } from '@/services/admin-staff.service';
import { usePagination } from '@/hooks/usePagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const ROOMS = ['General', 'Sala 1', 'Sala 2', 'Sala 3', 'Sala 4'];

export default function StaffPage() {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const { toast } = useToast();
  const eventId = event?.id;

  const { data: staff, isLoading } = useStaffMembers(eventId);
  const createStaff = useCreateStaffMember();
  const updateStaff = useUpdateStaffMember();
  const deleteStaff = useDeleteStaffMember();
  const inviteStaff = useInviteStaffUser();
  const setStatus = useSetStaffInvitationStatus();
  const toggleActive = useToggleStaffActive();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoom, setFormRoom] = useState('');

  const filteredStaff = searchQuery
    ? staff?.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.assigned_room ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : staff;

  const pagination = usePagination(filteredStaff ?? [], 10);

  const openNewModal = () => {
    setEditingStaff(null);
    setFormName('');
    setFormEmail('');
    setFormRoom('');
    setModalOpen(true);
  };

  const openEditModal = (s: StaffMember) => {
    setEditingStaff(s);
    setFormName(s.full_name);
    setFormEmail(s.contact_email);
    setFormRoom(s.assigned_room ?? '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!eventId || !formName || !formEmail) return;

    try {
      if (editingStaff) {
        await updateStaff.mutateAsync({
          id: editingStaff.id,
          updates: {
            full_name: formName,
            contact_email: formEmail,
            assigned_room: formRoom || null,
          },
        });
        toast({ title: t('staff.editSuccess') });
      } else {
        const expiresAt = event?.end_date
          ? new Date(new Date(event.end_date).getTime() + 86400000).toISOString()
          : undefined;

        await createStaff.mutateAsync({
          event_id: eventId,
          full_name: formName,
          contact_email: formEmail,
          assigned_room: formRoom || undefined,
          access_expires_at: expiresAt,
        });
        toast({ title: t('staff.createSuccessPending') });
      }
      setModalOpen(false);
    } catch {
      toast({ title: t('staff.saveError'), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStaff.mutateAsync(deleteTarget.id);
      toast({ title: t('staff.deleteSuccess') });
      setDeleteTarget(null);
    } catch {
      toast({ title: t('staff.deleteError'), variant: 'destructive' });
    }
  };

  const handleActivate = async (s: StaffMember) => {
    if (!eventId) return;
    try {
      await inviteStaff.mutateAsync({
        email: s.contact_email,
        full_name: s.full_name,
        event_id: eventId,
        assigned_room: s.assigned_room || undefined,
        access_expires_at: s.access_expires_at || undefined,
      });
      toast({ title: t('staff.activateSuccess', { name: s.full_name }) });
    } catch {
      toast({ title: t('staff.inviteError'), variant: 'destructive' });
    }
  };

  const handleResendInvite = async (s: StaffMember) => {
    if (!eventId) return;
    try {
      await inviteStaff.mutateAsync({
        email: s.contact_email,
        full_name: s.full_name,
        event_id: eventId,
        assigned_room: s.assigned_room || undefined,
        action: 'reinvite',
      });
      toast({ title: t('staff.inviteResent', { email: s.contact_email }) });
    } catch {
      toast({ title: t('staff.inviteError'), variant: 'destructive' });
    }
  };

  const handleToggleAccess = async (s: StaffMember, next: boolean) => {
    try {
      await toggleActive.mutateAsync({ id: s.id, isActive: next });
      toast({ title: t(next ? 'staff.accessRestored' : 'staff.accessSuspended') });
    } catch {
      toast({ title: t('staff.saveError'), variant: 'destructive' });
    }
  };

  const statusBadge = (s: StaffMember) => {
    if (s.invitation_status === 'active') {
      return <Badge className="bg-accent/10 text-accent border-accent/30">{t('staff.statusActiveLabel')}</Badge>;
    }
    return <Badge variant="outline" className="border-amber-400/40 text-amber-600 dark:text-amber-400">{t('staff.statusPendingLabel')}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('staff.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('staff.subtitle')}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openNewModal}>
          <Plus className="mr-2 h-4 w-4" />
          {t('staff.newStaff')}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 py-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <span className="text-xl font-bold text-foreground">{staff?.length ?? 0}</span>
              <span className="ml-2 text-sm text-muted-foreground">{t('staff.totalStaff')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('staff.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !filteredStaff || filteredStaff.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t('staff.noStaff')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('staff.colName')}</TableHead>
              <TableHead>{t('staff.colRoom')}</TableHead>
              <TableHead>{t('staff.colEmail')}</TableHead>
              <TableHead>{t('staff.colInvitation')}</TableHead>
              <TableHead>{t('staff.colAccess')}</TableHead>
              <TableHead>{t('staff.colLastLogin')}</TableHead>
              <TableHead>{t('staff.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.map((s) => {
              const isActive = s.invitation_status === 'active';
              return (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {s.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground">{s.full_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {s.assigned_room ? (
                    <Badge variant="outline" className="border-accent/30 text-accent">{s.assigned_room}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.contact_email}</TableCell>
                <TableCell>{statusBadge(s)}</TableCell>
                <TableCell>
                  {isActive ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={(v) => handleToggleAccess(s, v)}
                        aria-label={t('staff.toggleAccess')}
                      />
                      <span className="text-xs text-muted-foreground">
                        {s.is_active ? t('staff.accessEnabled') : t('staff.accessDisabled')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.last_login
                    ? format(new Date(s.last_login), 'dd/MM HH:mm')
                    : t('staff.noAccess')}
                </TableCell>
                <TableCell>
                  <TooltipProvider delayDuration={150}>
                    <div className="flex items-center gap-1">
                      {!isActive && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-accent hover:text-accent"
                              onClick={() => handleActivate(s)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('staff.tooltips.activate', { defaultValue: 'Activar cuenta del miembro de personal' })}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {isActive && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleResendInvite(s)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('staff.tooltips.resend', { defaultValue: 'Reenviar correo de invitación al staff' })}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditModal(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('staff.tooltips.edit', { defaultValue: 'Editar datos del miembro de personal' })}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('staff.tooltips.delete', { defaultValue: 'Eliminar miembro de personal' })}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
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
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? t('staff.editTitle') : t('staff.newTitle')}</DialogTitle>
            <DialogDescription>{t('staff.subtitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('staff.fieldName')}</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('staff.fieldNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('staff.fieldEmail')}</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder={t('staff.fieldEmailPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('staff.fieldRoom')}</Label>
              <Select value={formRoom} onValueChange={setFormRoom}>
                <SelectTrigger>
                  <SelectValue placeholder={t('staff.fieldRoomPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {ROOMS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingStaff && (
              <p className="text-xs text-muted-foreground rounded-md bg-muted p-2">
                {t('staff.createPendingHint')}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                {t('staff.cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formName || !formEmail || createStaff.isPending || updateStaff.isPending}
              >
                {createStaff.isPending || updateStaff.isPending ? t('staff.saving') : t('staff.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('staff.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('staff.deleteConfirm', { name: deleteTarget?.full_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('staff.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={handleDelete}
            >
              {t('staff.deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
