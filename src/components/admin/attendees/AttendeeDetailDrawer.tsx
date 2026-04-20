import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, RefreshCw, Mail, Bus, UtensilsCrossed, Sparkles, Map, Plus, Trash2, Ban, RotateCcw, KeyRound, Copy } from 'lucide-react';
import { format } from 'date-fns';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAttendeeDetail, useUpdateServiceStatus, useDeleteService, useSendInvitations, useUpdateAttendeeStatus, useInvitationLog } from '@/hooks/useAdminAttendees';
import { adminAttendeesService } from '@/services/admin-attendees.service';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { AddServiceModal } from './AddServiceModal';

interface Props {
  attendeeId: string | null;
  onClose: () => void;
}

const SERVICE_ICONS: Record<string, typeof Bus> = {
  transport: Bus,
  food: UtensilsCrossed,
  special: Sparkles,
  tour: Map,
};

const SERVICE_COLORS: Record<string, string> = {
  transport: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  food: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300',
  special: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
  tour: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300',
};

export function AttendeeDetailDrawer({ attendeeId, onClose }: Props) {
  const { t } = useTranslation('admin');
  const { data, isLoading } = useAttendeeDetail(attendeeId);
  const queryClient = useQueryClient();
  const updateStatusMutation = useUpdateServiceStatus();
  const deleteServiceMutation = useDeleteService();
  const sendInvitationsMutation = useSendInvitations();
  const updateAttendeeStatusMutation = useUpdateAttendeeStatus();
  const [showAddService, setShowAddService] = useState(false);
  const [confirmToggleActive, setConfirmToggleActive] = useState(false);
  const [confirmRegenAccess, setConfirmRegenAccess] = useState(false);
  const [confirmRegenCredential, setConfirmRegenCredential] = useState(false);
  const [regeneratingAccess, setRegeneratingAccess] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!attendeeId) return;
    try {
      await adminAttendeesService.regenerateCode(attendeeId);
      queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail', attendeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
      toast({ title: t('attendees.detail.regenerateSuccess') });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setConfirmRegenCredential(false);
    }
  };

  const handleSendCredentials = async () => {
    if (!attendeeId) return;
    try {
      const result = await sendInvitationsMutation.mutateAsync([attendeeId]);
      if (result.sent > 0) {
        toast({ title: t('attendees.invitationSent') });
      } else {
        toast({ title: t('attendees.invitationFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('attendees.invitationFailed'), variant: 'destructive' });
    }
  };

  const handleRegenerateAccess = async (sendEmail: boolean) => {
    if (!attendeeId) return;
    setRegeneratingAccess(true);
    try {
      const { access_code, email_sent } = await adminAttendeesService.regenerateAccessCode(attendeeId, sendEmail);
      queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail', attendeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
      setNewAccessCode(access_code);
      setConfirmRegenAccess(false);
      toast({
        title: t('attendees.detail.regenerateAccessSuccess'),
        description: sendEmail && email_sent ? t('attendees.invitationSent') : undefined,
      });
    } catch {
      toast({ title: t('attendees.detail.regenerateAccessError'), variant: 'destructive' });
    } finally {
      setRegeneratingAccess(false);
    }
  };

  const handleCopyAccessCode = async () => {
    if (!newAccessCode) return;
    try {
      await navigator.clipboard.writeText(newAccessCode);
      toast({ title: t('attendees.detail.codeCopied') });
    } catch {
      // ignore clipboard error
    }
  };

  const handleStatusChange = async (serviceId: string, status: string) => {
    try {
      await updateStatusMutation.mutateAsync({ serviceId, status });
      toast({ title: t('attendees.detail.statusUpdated') });
    } catch {
      toast({ title: t('attendees.detail.statusUpdateError'), variant: 'destructive' });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!window.confirm(t('attendees.detail.deleteServiceConfirm'))) return;
    try {
      await deleteServiceMutation.mutateAsync(serviceId);
      toast({ title: t('attendees.detail.serviceDeleted') });
    } catch {
      toast({ title: t('attendees.detail.serviceDeleteError'), variant: 'destructive' });
    }
  };

  const handleAttendeeStatusChange = async (newStatus: string) => {
    if (!attendeeId) return;
    try {
      await updateAttendeeStatusMutation.mutateAsync({ id: attendeeId, status: newStatus });
      toast({ title: t('attendees.detail.statusUpdated') });
    } catch {
      toast({ title: t('attendees.detail.statusUpdateError'), variant: 'destructive' });
    }
  };

  // Determine credential button state
  const attendee = data?.attendee;
  const hasBeenSent = !!attendee?.invitation_sent_at;
  const isCancelled = attendee?.registration_status === 'cancelled';

  const handleToggleActive = async () => {
    if (!attendeeId) return;
    const newStatus = isCancelled ? 'pending' : 'cancelled';
    try {
      await updateAttendeeStatusMutation.mutateAsync({ id: attendeeId, status: newStatus });
      toast({ title: t(isCancelled ? 'attendees.reactivateSuccess' : 'attendees.deactivateSuccess') });
      setConfirmToggleActive(false);
    } catch {
      toast({ title: t('attendees.deactivateError'), variant: 'destructive' });
    }
  };

  return (
    <>
      <Sheet open={!!attendeeId} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="w-full sm:max-w-md overflow-auto">
          <SheetHeader>
            <SheetTitle>{t('attendees.detail.title')}</SheetTitle>
          </SheetHeader>

          {isLoading || !data ? (
            <div className="space-y-4 mt-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-6 mt-4">
              {/* Profile */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t('attendees.detail.profile')}</h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {data.attendee.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{data.attendee.full_name}</div>
                    <div className="text-sm text-muted-foreground">{data.attendee.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {data.attendee.specialty && (
                    <div>
                      <span className="text-muted-foreground">{t('attendees.detail.specialty')}:</span>
                      <span className="ml-1 text-foreground">{data.attendee.specialty}</span>
                    </div>
                  )}
                  {data.attendee.institution && (
                    <div>
                      <span className="text-muted-foreground">{t('attendees.detail.institution')}:</span>
                      <span className="ml-1 text-foreground">{data.attendee.institution}</span>
                    </div>
                  )}
                  {data.attendee.phone && (
                    <div>
                      <span className="text-muted-foreground">{t('attendees.detail.phone')}:</span>
                      <span className="ml-1 text-foreground">{data.attendee.phone}</span>
                    </div>
                  )}
                  {data.attendee.external_credential_code && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">{t('attendees.congressCode')}:</span>
                      <span className="ml-1 font-mono text-foreground">{data.attendee.external_credential_code}</span>
                    </div>
                  )}
                  {data.attendee.registration_date && (
                    <div>
                      <span className="text-muted-foreground">{t('attendees.detail.registrationDate')}:</span>
                      <span className="ml-1 text-foreground">
                        {format(new Date(data.attendee.registration_date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )}
                  {data.attendee.invitation_sent_at && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">{t('attendees.detail.invitationSentAt')}:</span>
                      <span className="ml-1 text-foreground">
                        {format(new Date(data.attendee.invitation_sent_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('attendees.newAttendeeModal.status')}:</span>
                  <Select
                    value={data.attendee.registration_status || 'pending'}
                    onValueChange={handleAttendeeStatusChange}
                  >
                    <SelectTrigger className="h-7 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">{t('attendees.statusConfirmed')}</SelectItem>
                      <SelectItem value="pending">{t('attendees.statusPending')}</SelectItem>
                      <SelectItem value="cancelled">{t('attendees.statusCancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant={isCancelled ? 'outline' : 'outline'}
                  size="sm"
                  onClick={() => setConfirmToggleActive(true)}
                  className={cn(
                    'w-full',
                    isCancelled
                      ? 'border-accent/30 text-accent hover:bg-accent/10'
                      : 'border-destructive/30 text-destructive hover:bg-destructive/10',
                  )}
                >
                  {isCancelled ? <RotateCcw className="mr-2 h-3.5 w-3.5" /> : <Ban className="mr-2 h-3.5 w-3.5" />}
                  {t(isCancelled ? 'attendees.reactivateButton' : 'attendees.deactivateButton')}
                </Button>
              </div>

              <Separator />

              {/* Credential Code (Display + QR) */}
              <TooltipProvider delayDuration={200}>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t('attendees.detail.credentialDisplay')}</h3>
                  <div className="font-mono text-lg text-primary font-bold text-center">
                    {data.attendee.credential_code}
                  </div>
                  <div className="flex justify-center">
                    <QRCodeSVG value={data.attendee.credential_code} size={120} />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setConfirmRegenCredential(true)}>
                        <RefreshCw className="mr-2 h-3 w-3" />
                        {t('attendees.detail.regenerateCode')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('attendees.detail.regenerateCodeTooltip')}</TooltipContent>
                  </Tooltip>
                </div>

                <Separator />

                {/* Access Code (Login) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-accent" />
                    {t('attendees.detail.accessCodeSection')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('attendees.detail.accessCodeDescription')}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    {t('attendees.detail.accessCodeHidden')}
                  </p>
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setConfirmRegenAccess(true)}
                          disabled={regeneratingAccess}
                        >
                          <KeyRound className="mr-2 h-3 w-3" />
                          {t('attendees.detail.regenerateAccessCode')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('attendees.detail.regenerateAccessCodeTooltip')}</TooltipContent>
                    </Tooltip>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleSendCredentials}
                      disabled={sendInvitationsMutation.isPending}
                    >
                      <Mail className="mr-2 h-3 w-3" />
                      {sendInvitationsMutation.isPending
                        ? t('attendees.sendingInvitation')
                        : hasBeenSent
                          ? t('attendees.resendCredentials')
                          : t('attendees.sendCredentials')}
                    </Button>
                  </div>
                </div>
              </TooltipProvider>

              <Separator />

              {/* Services */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{t('attendees.detail.services')}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-accent border-accent/30 hover:bg-accent/10"
                    onClick={() => setShowAddService(true)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {t('attendees.detail.addService')}
                  </Button>
                </div>
                {data.services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('attendees.detail.noServices')}</p>
                ) : (
                  <div className="space-y-2">
                    {data.services.map((s: any) => {
                      const catalog = s.service_catalog as any;
                      const serviceType = catalog?.service_type || 'special';
                      const Icon = SERVICE_ICONS[serviceType] || Sparkles;
                      const colorClass = SERVICE_COLORS[serviceType] || SERVICE_COLORS.special;

                      return (
                        <div key={s.id} className="rounded-lg border p-3 space-y-2">
                          <div className="flex items-start gap-3">
                            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', colorClass)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-foreground">
                                {catalog?.name ?? s.service_catalog_id}
                              </div>
                              {s.scheduled_date && (
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(s.scheduled_date), 'dd/MM/yyyy')}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={s.status || 'scheduled'}
                              onValueChange={(val) => handleStatusChange(s.id, val)}
                            >
                              <SelectTrigger className="h-7 w-[130px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="scheduled">{t('attendees.detail.statusScheduled')}</SelectItem>
                                <SelectItem value="completed">{t('attendees.detail.statusCompleted')}</SelectItem>
                                <SelectItem value="cancelled">{t('attendees.detail.statusCancelled')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteService(s.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Invitation send history */}
              <InvitationHistorySection attendeeId={attendeeId} />

              <Separator />

              {/* Check-ins */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t('attendees.detail.checkins')}</h3>
                {data.checkins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('attendees.detail.noCheckins')}</p>
                ) : (
                  <div className="space-y-2">
                    {data.checkins.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground">{(c.event_activities as any)?.title ?? c.activity_id}</span>
                        </div>
                        {c.checked_in_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(c.checked_in_at), 'dd/MM HH:mm')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {attendeeId && (
        <AddServiceModal
          open={showAddService}
          onOpenChange={setShowAddService}
          attendeeId={attendeeId}
        />
      )}

      <AlertDialog open={confirmToggleActive} onOpenChange={setConfirmToggleActive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(isCancelled ? 'attendees.reactivateTitle' : 'attendees.deactivateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(isCancelled ? 'attendees.reactivateConfirm' : 'attendees.deactivateConfirm', {
                name: attendee?.full_name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('attendees.deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              className={isCancelled ? 'bg-accent text-accent-foreground' : 'bg-destructive text-destructive-foreground'}
            >
              {t(isCancelled ? 'attendees.reactivate' : 'attendees.deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRegenCredential} onOpenChange={setConfirmRegenCredential}>
        <AlertDialogContent className="w-[calc(100%-1.5rem)] max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {t('attendees.detail.regenerateCredentialDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t('attendees.detail.regenerateCredentialDialog.message')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto mt-0">
              {t('attendees.detail.regenerateCredentialDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerate}
              className="w-full sm:w-auto bg-primary text-primary-foreground"
            >
              {t('attendees.detail.regenerateCredentialDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRegenAccess} onOpenChange={setConfirmRegenAccess}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('attendees.detail.regenerateAccessCode')}</AlertDialogTitle>
            <AlertDialogDescription>{t('attendees.detail.regenerateAccessConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regeneratingAccess}>
              {t('attendees.deleteConfirm.cancel')}
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleRegenerateAccess(false)}
              disabled={regeneratingAccess}
            >
              <KeyRound className="mr-2 h-3.5 w-3.5" />
              {t('attendees.detail.regenerateAccessCode')}
            </Button>
            <AlertDialogAction
              onClick={() => handleRegenerateAccess(true)}
              disabled={regeneratingAccess}
              className="bg-primary text-primary-foreground"
            >
              <Mail className="mr-2 h-3.5 w-3.5" />
              {t('attendees.detail.sendByEmailNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!newAccessCode} onOpenChange={(o) => !o && setNewAccessCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('attendees.detail.newAccessCodeTitle')}</DialogTitle>
            <DialogDescription>{t('attendees.detail.newAccessCodeDescription')}</DialogDescription>
          </DialogHeader>
          <div className="my-4 rounded-lg border-2 border-dashed border-primary bg-muted p-6 text-center">
            <div className="font-mono text-3xl font-bold tracking-widest text-primary">
              {newAccessCode}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCopyAccessCode}>
              <Copy className="mr-2 h-4 w-4" />
              {t('attendees.detail.copyCode')}
            </Button>
            <Button onClick={() => setNewAccessCode(null)}>
              {t('attendees.deleteConfirm.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
