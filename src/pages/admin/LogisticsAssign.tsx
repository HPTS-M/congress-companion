import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useEvent } from '@/hooks/useEvent';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminLogisticsService } from '@/services/admin-logistics.service';
import type { ServiceAssignee, UnassignedAttendee } from '@/services/admin-logistics.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Search, Plus, UserMinus, Bus, UtensilsCrossed, Map, Sparkles,
  Users, Upload,
} from 'lucide-react';
import { toast } from 'sonner';

const TYPE_ICONS: Record<string, React.ElementType> = {
  transport: Bus, food: UtensilsCrossed, tour: Map, special: Sparkles,
};

export default function LogisticsAssign() {
  const { t } = useTranslation('admin');
  const { eventSlug, serviceId } = useParams();
  const navigate = useNavigate();
  const { event } = useEvent();
  const qc = useQueryClient();

  const [searchAssigned, setSearchAssigned] = useState('');
  const [searchUnassigned, setSearchUnassigned] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [statusEdit, setStatusEdit] = useState<ServiceAssignee | null>(null);
  const [statusValue, setStatusValue] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'all' | 'confirmed'>('confirmed');

  // Fetch service catalog item
  const { data: services } = useQuery({
    queryKey: ['admin-logistics', event?.id],
    queryFn: () => adminLogisticsService.getAll(event!.id),
    enabled: !!event?.id,
  });
  const service = services?.find((s) => s.id === serviceId);

  // Fetch assignees
  const assigneesKey = ['logistics-assignees', serviceId];
  const { data: assignees = [], isLoading: loadingAssignees } = useQuery({
    queryKey: assigneesKey,
    queryFn: () => adminLogisticsService.getAssignees(serviceId!),
    enabled: !!serviceId,
  });

  // Fetch unassigned
  const unassignedKey = ['logistics-unassigned', event?.id, serviceId];
  const { data: unassigned = [], isLoading: loadingUnassigned } = useQuery({
    queryKey: unassignedKey,
    queryFn: () => adminLogisticsService.getUnassigned(event!.id, serviceId!),
    enabled: !!event?.id && !!serviceId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: assigneesKey });
    qc.invalidateQueries({ queryKey: unassignedKey });
    qc.invalidateQueries({ queryKey: ['admin-logistics', event?.id] });
  };

  const assignMut = useMutation({
    mutationFn: (attendeeId: string) => adminLogisticsService.assignAttendee(serviceId!, attendeeId),
    onSuccess: () => { invalidateAll(); toast.success(t('logistics.assign.assignSuccess')); },
    onError: () => toast.error(t('logistics.assign.assignError')),
  });

  const unassignMut = useMutation({
    mutationFn: (attendeeServiceId: string) => adminLogisticsService.unassignAttendee(attendeeServiceId),
    onSuccess: () => { invalidateAll(); setRemovingId(null); toast.success(t('logistics.assign.unassignSuccess')); },
    onError: () => toast.error(t('logistics.assign.unassignError')),
  });

  const statusMut = useMutation({
    mutationFn: () => adminLogisticsService.updateTicketStatus(statusEdit!.attendee_service_id, statusValue, statusNote || undefined),
    onSuccess: () => { invalidateAll(); setStatusEdit(null); toast.success(t('logistics.assign.statusUpdated')); },
    onError: () => toast.error(t('logistics.assign.statusError')),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const ids = bulkMode === 'confirmed'
        ? await adminLogisticsService.getConfirmedAttendeeIds(event!.id)
        : await adminLogisticsService.getAllAttendeeIds(event!.id);
      // Filter out already assigned
      const assignedIds = new Set(assignees.map((a) => a.attendee_id));
      const toAssign = ids.filter((id) => !assignedIds.has(id));
      return adminLogisticsService.bulkAssign(serviceId!, toAssign);
    },
    onSuccess: (result) => {
      invalidateAll();
      setBulkOpen(false);
      toast.success(t('logistics.assign.bulkResult', { assigned: result.assigned, errors: result.errors }));
    },
    onError: () => toast.error(t('logistics.assign.bulkError')),
  });

  const filteredAssigned = useMemo(() => {
    if (!searchAssigned.trim()) return assignees;
    const q = searchAssigned.toLowerCase();
    return assignees.filter((a) => a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [assignees, searchAssigned]);

  const filteredUnassigned = useMemo(() => {
    if (!searchUnassigned.trim()) return unassigned;
    const q = searchUnassigned.toLowerCase();
    return unassigned.filter((a) => a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.credential_code.toLowerCase().includes(q));
  }, [unassigned, searchUnassigned]);

  const openStatusEdit = useCallback((a: ServiceAssignee) => {
    setStatusEdit(a);
    setStatusValue(a.status ?? 'scheduled');
    setStatusNote('');
  }, []);

  const Icon = TYPE_ICONS[service?.service_type ?? ''] ?? Bus;

  if (!service && !loadingAssignees) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t('logistics.noServices')}
      </div>
    );
  }

  const statusColor = (s: string | null) => {
    switch (s) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  const statusLabel = (s: string | null) => {
    switch (s) {
      case 'completed': return t('logistics.assign.statusUsed');
      case 'cancelled': return t('logistics.assign.statusCancelled');
      default: return t('logistics.assign.statusPending');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/${eventSlug}/admin/logistics`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{service?.name ?? '...'}</h1>
            <p className="text-sm text-muted-foreground">
              {service?.location && `${service.location} · `}
              {service?.valid_from && service?.valid_until
                ? `${service.valid_from.slice(0, 5)} – ${service.valid_until.slice(0, 5)}`
                : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> {t('logistics.assign.bulkAssign')}
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Assigned */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t('logistics.assign.assignedTitle')} ({assignees.length})
              </span>
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchAssigned} onChange={(e) => setSearchAssigned(e.target.value)} placeholder={t('logistics.assign.searchAssigned')} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingAssignees ? (
              <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : filteredAssigned.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">{t('logistics.noAssignees')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('logistics.colAttendee')}</TableHead>
                    <TableHead>{t('logistics.colTicket')}</TableHead>
                    <TableHead>{t('logistics.colStatus')}</TableHead>
                    <TableHead className="text-right">{t('logistics.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssigned.map((a) => (
                    <TableRow key={a.attendee_service_id}>
                      <TableCell>
                        <p className="font-medium text-foreground text-sm">{a.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.credential_code}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{a.ticket_code ?? '—'}</TableCell>
                      <TableCell>
                        <Badge className={`cursor-pointer ${statusColor(a.status)}`} onClick={() => openStatusEdit(a)}>
                          {statusLabel(a.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setRemovingId(a.attendee_service_id)} className="text-destructive hover:text-destructive" title={t('logistics.assign.remove')}>
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Unassigned */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t('logistics.assign.unassignedTitle')} ({unassigned.length})
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchUnassigned} onChange={(e) => setSearchUnassigned(e.target.value)} placeholder={t('logistics.assign.searchUnassigned')} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingUnassigned ? (
              <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : filteredUnassigned.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">{t('logistics.assign.allAssigned')}</p>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('logistics.colAttendee')}</TableHead>
                      <TableHead>{t('logistics.assign.specialty')}</TableHead>
                      <TableHead className="text-right">{t('logistics.colActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnassigned.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <p className="font-medium text-foreground text-sm">{a.full_name}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.specialty ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => assignMut.mutate(a.id)} disabled={assignMut.isPending} className="text-primary hover:text-primary">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Remove confirm */}
      <AlertDialog open={!!removingId} onOpenChange={(o) => !o && setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logistics.assign.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('logistics.assign.removeConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sponsors.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => removingId && unassignMut.mutate(removingId)} className="bg-destructive text-destructive-foreground">
              {t('logistics.assign.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status edit dialog */}
      <Dialog open={!!statusEdit} onOpenChange={(o) => !o && setStatusEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('logistics.assign.changeStatus')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{statusEdit?.full_name}</p>
            <Select value={statusValue} onValueChange={setStatusValue}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">{t('logistics.assign.statusPending')}</SelectItem>
                <SelectItem value="completed">{t('logistics.assign.statusUsed')}</SelectItem>
                <SelectItem value="cancelled">{t('logistics.assign.statusCancelled')}</SelectItem>
              </SelectContent>
            </Select>
            <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder={t('logistics.assign.notePlaceholder')} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusEdit(null)}>{t('sponsors.cancel')}</Button>
              <Button onClick={() => statusMut.mutate()} disabled={statusMut.isPending} className="bg-primary text-primary-foreground">
                {t('sponsors.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk assign dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('logistics.assign.bulkAssign')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('logistics.assign.bulkDescription')}</p>
            <Select value={bulkMode} onValueChange={(v) => setBulkMode(v as 'all' | 'confirmed')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">{t('logistics.assign.bulkConfirmed')}</SelectItem>
                <SelectItem value="all">{t('logistics.assign.bulkAll')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkOpen(false)}>{t('sponsors.cancel')}</Button>
              <Button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending} className="bg-primary text-primary-foreground">
                {bulkMut.isPending ? t('logistics.assign.assigning') : t('logistics.assign.bulkConfirmBtn')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
