import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useCreateAttendee, useUpdateAttendee, useExistingEmails, useExistingExternalCodes } from '@/hooks/useAdminAttendees';
import { useEvent } from '@/hooks/useEvent';
import type { AttendeeWithServices } from '@/services/admin-attendees.service';
import { EXTERNAL_CODE_REGEX } from '@/lib/import-validators';

const schema = z.object({
  full_name: z.string().trim().min(1, 'Required').max(200),
  email: z.string().trim().email('Invalid email').max(255),
  specialty: z.string().trim().max(100).optional().or(z.literal('')),
  institution: z.string().trim().max(200).optional().or(z.literal('')),
  registration_status: z.string().default('pending'),
  external_credential_code: z.string().trim().max(50).optional().or(z.literal('')),
});

type FormValues = {
  full_name: string;
  email: string;
  specialty?: string;
  institution?: string;
  registration_status: string;
  external_credential_code?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendee?: AttendeeWithServices | null;
}

const DRAFT_KEY = (eventId: string) => `attendee-draft-${eventId}-new`;

const emptyValues: FormValues = {
  full_name: '',
  email: '',
  specialty: '',
  institution: '',
  registration_status: 'pending',
  external_credential_code: '',
};

export function NewAttendeeModal({ open, onOpenChange, attendee }: Props) {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const queryClient = useQueryClient();
  const createMutation = useCreateAttendee();
  const updateMutation = useUpdateAttendee();
  const { data: existingEmails } = useExistingEmails();
  const { data: existingExternalCodes } = useExistingExternalCodes();
  const externalCredentialsEnabled =
    ((event?.settings ?? {}) as Record<string, unknown>).external_credentials_enabled === true;
  const isEditMode = !!attendee;
  const eventId = event?.id ?? '';
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const draftLoadedRef = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  // Reset / draft recovery on open
  useEffect(() => {
    if (!open) {
      draftLoadedRef.current = false;
      return;
    }
    if (attendee) {
      form.reset({
        full_name: attendee.full_name,
        email: attendee.email,
        specialty: attendee.specialty || '',
        institution: attendee.institution || '',
        registration_status: attendee.registration_status || 'pending',
        external_credential_code: attendee.external_credential_code || '',
      });
    } else {
      // New mode: try to restore draft
      if (eventId && !draftLoadedRef.current) {
        try {
          const raw = localStorage.getItem(DRAFT_KEY(eventId));
          if (raw) {
            const draft = JSON.parse(raw) as Partial<FormValues>;
            form.reset({ ...emptyValues, ...draft });
            draftLoadedRef.current = true;
            return;
          }
        } catch {
          /* ignore */
        }
      }
      form.reset(emptyValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attendee, eventId]);

  // Auto-save draft for new attendee every 2s while dirty
  useEffect(() => {
    if (!open || !eventId || isEditMode) return;
    const interval = setInterval(() => {
      if (form.formState.isDirty) {
        try {
          localStorage.setItem(DRAFT_KEY(eventId), JSON.stringify(form.getValues()));
        } catch {
          /* ignore */
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [open, eventId, isEditMode, form]);

  const clearDraft = () => {
    if (!eventId) return;
    try {
      localStorage.removeItem(DRAFT_KEY(eventId));
    } catch {
      /* ignore */
    }
  };

  const tryClose = () => {
    if (form.formState.isDirty) {
      setConfirmDiscard(true);
    } else {
      onOpenChange(false);
    }
  };

  const confirmClose = () => {
    setConfirmDiscard(false);
    if (!isEditMode) clearDraft();
    onOpenChange(false);
  };

  const onSubmit = async (values: FormValues) => {
    const attendeeId = attendee?.id;
    const attendeeEmail = attendee?.email;

    const emailLower = values.email.toLowerCase();
    const emails = existingEmails ?? [];
    const isDuplicate = emails.includes(emailLower);
    const isSelfEmail = isEditMode && attendeeEmail?.toLowerCase() === emailLower;

    if (isDuplicate && !isSelfEmail) {
      form.setError('email', { message: t('attendees.importModal.duplicateEmailDb') });
      return;
    }

    try {
      if (isEditMode && attendeeId) {
        await updateMutation.mutateAsync({
          id: attendeeId,
          data: {
            full_name: values.full_name,
            email: values.email,
            specialty: values.specialty || null,
            institution: values.institution || null,
            registration_status: values.registration_status,
            external_credential_code: externalCredentialsEnabled
              ? (values.external_credential_code?.trim() || null)
              : undefined,
          },
        });
        toast({ title: t('attendees.newAttendeeModal.updateSuccess') });
      } else {
        const created = await createMutation.mutateAsync({
          ...values,
          external_credential_code: externalCredentialsEnabled
            ? (values.external_credential_code?.trim() || null)
            : null,
        });
        toast({
          title: t('attendees.newAttendeeModal.success'),
          description: t('attendees.newAttendeeModal.successCode', { code: created.credential_code }),
        });
        clearDraft();
      }
      // Force refetch BEFORE closing so the table reflects the new row instantly
      await queryClient.refetchQueries({ queryKey: ['admin-attendees'], type: 'active' });
      onOpenChange(false);
    } catch {
      toast({
        title: isEditMode ? t('attendees.newAttendeeModal.updateError') : t('attendees.newAttendeeModal.error'),
        variant: 'destructive',
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) tryClose(); else onOpenChange(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? t('attendees.newAttendeeModal.titleEdit') : t('attendees.newAttendeeModal.title')}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('attendees.newAttendeeModal.fullName')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('attendees.newAttendeeModal.fullNamePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('attendees.newAttendeeModal.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('attendees.newAttendeeModal.emailPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('attendees.newAttendeeModal.specialty')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('attendees.newAttendeeModal.specialtyPlaceholder')} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="institution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('attendees.newAttendeeModal.institution')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('attendees.newAttendeeModal.institutionPlaceholder')} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {externalCredentialsEnabled && (
                <FormField
                  control={form.control}
                  name="external_credential_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('attendees.congressCode')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('attendees.congressCodePlaceholder')}
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            const v = e.target.value.trim();
                            if (!v) return;
                            if (!EXTERNAL_CODE_REGEX.test(v)) {
                              form.setError('external_credential_code', {
                                message: t('attendees.newAttendeeModal.externalCodeInvalid'),
                              });
                              return;
                            }
                            const codes = (existingExternalCodes ?? []).map((c) => c.toUpperCase());
                            const isSelf = isEditMode && (attendee?.external_credential_code ?? '').toUpperCase() === v.toUpperCase();
                            if (codes.includes(v.toUpperCase()) && !isSelf) {
                              form.setError('external_credential_code', {
                                message: t('attendees.newAttendeeModal.externalCodeDuplicate'),
                              });
                            } else {
                              form.clearErrors('external_credential_code');
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="registration_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('attendees.newAttendeeModal.status')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="confirmed">{t('attendees.statusConfirmed')}</SelectItem>
                        <SelectItem value="pending">{t('attendees.statusPending')}</SelectItem>
                        <SelectItem value="cancelled">{t('attendees.statusCancelled')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {field.value === 'confirmed'
                        ? t('attendees.confirmedHint')
                        : field.value === 'cancelled'
                          ? t('attendees.cancelledHint')
                          : t('attendees.pendingHint')}
                    </p>
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={tryClose} disabled={isPending}>
                  {t('attendees.deleteConfirm.cancel')}
                </Button>
                <Button type="submit" className="flex-1" disabled={isPending}>
                  {isPending
                    ? t('attendees.newAttendeeModal.saving')
                    : isEditMode
                      ? t('attendees.newAttendeeModal.saveEdit')
                      : t('attendees.newAttendeeModal.save')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('attendees.newAttendeeModal2.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('attendees.newAttendeeModal2.discardDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('attendees.newAttendeeModal2.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} className="bg-destructive text-destructive-foreground">
              {t('attendees.newAttendeeModal2.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
