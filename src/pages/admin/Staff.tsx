import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Mail, Pencil, Trash2, Users, Search,
} from 'lucide-react';
import { useEvent } from '@/hooks/useEvent';
import {
  useStaffMembers, useCreateStaffMember, useUpdateStaffMember,
  useDeleteStaffMember, useInviteStaffUser,
} from '@/hooks/useAdminStaff';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
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

        // Send invitation
        try {
          await inviteStaff.mutateAsync({
            email: formEmail,
            full_name: formName,
            event_id: eventId,
            assigned_room: formRoom || undefined,
            access_expires_at: expiresAt,
          });
          toast({ title: t('staff.createSuccess') });
        } catch {
          toast({ title: t('staff.createSuccessNoInvite'), variant: 'destructive' });
        }
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

  const statusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-accent/10 text-accent border-accent/30">{t('staff.statusActive')}</Badge>;
      case 'expired':
        return <Badge variant="secondary">{t('staff.statusExpired')}</Badge>;
      default:
        return <Badge variant="outline" className="border-primary/30 text-primary">{t('staff.statusPending')}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Stats */}
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('staff.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('staff.colName')}</TableHead>
              <TableHead>{t('staff.colRoom')}</TableHead>
              <TableHead>{t('staff.colEmail')}</TableHead>
              <TableHead>{t('staff.colInvitation')}</TableHead>
              <TableHead>{t('staff.colLastLogin')}</TableHead>
              <TableHead>{t('staff.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff.map((s) => (
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
                <TableCell>{statusBadge(s.invitation_status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.last_login
                    ? format(new Date(s.last_login), 'dd/MM HH:mm')
                    : t('staff.noAccess')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleResendInvite(s)}
                      title={t('staff.resendInvite')}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditModal(s)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
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

      {/* Delete Confirmation */}
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
