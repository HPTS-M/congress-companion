import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useCreateAttendee, useUpdateAttendee, useExistingEmails } from '@/hooks/useAdminAttendees';
import type { AttendeeWithServices } from '@/services/admin-attendees.service';

const schema = z.object({
  full_name: z.string().trim().min(1, 'Required').max(200),
  email: z.string().trim().email('Invalid email').max(255),
  specialty: z.string().trim().max(100).optional().or(z.literal('')),
  institution: z.string().trim().max(200).optional().or(z.literal('')),
  registration_status: z.string().default('pending'),
});

type FormValues = {
  full_name: string;
  email: string;
  specialty?: string;
  institution?: string;
  registration_status: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendee?: AttendeeWithServices | null;
}

export function NewAttendeeModal({ open, onOpenChange, attendee }: Props) {
  const { t } = useTranslation('admin');
  const createMutation = useCreateAttendee();
  const updateMutation = useUpdateAttendee();
  const { data: existingEmails } = useExistingEmails();
  const isEditMode = !!attendee;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      specialty: '',
      institution: '',
      registration_status: 'pending',
    },
  });

  useEffect(() => {
    if (open && attendee) {
      form.reset({
        full_name: attendee.full_name,
        email: attendee.email,
        specialty: attendee.specialty || '',
        institution: attendee.institution || '',
        registration_status: attendee.registration_status || 'pending',
      });
    } else if (open && !attendee) {
      form.reset({
        full_name: '',
        email: '',
        specialty: '',
        institution: '',
        registration_status: 'pending',
      });
    }
  }, [open, attendee, form]);

  const onSubmit = async (values: FormValues) => {
    // Capture id locally to avoid stale closures
    const attendeeId = attendee?.id;
    const attendeeEmail = attendee?.email;

    // Validate email against DB
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
          },
        });
        toast({ title: t('attendees.newAttendeeModal.updateSuccess') });
      } else {
        const created = await createMutation.mutateAsync(values);
        toast({
          title: t('attendees.newAttendeeModal.success'),
          description: t('attendees.newAttendeeModal.successCode', { code: created.credential_code }),
        });
      }
      // Close first; useEffect handles reset on next open
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending
                ? t('attendees.newAttendeeModal.saving')
                : isEditMode
                  ? t('attendees.newAttendeeModal.saveEdit')
                  : t('attendees.newAttendeeModal.save')}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
