import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  useAttendeeDetail,
  useCreateAttendee,
  useUpdateAttendee
} from '@/hooks/useAdminAttendees';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

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
  attendeeId?: string | null;
}

export function NewAttendeeModal({ open, onOpenChange, attendeeId = null }: Props) {
  const { t } = useTranslation('admin');
  const isEditing = attendeeId !== null;

  // Load existing data when editing
  const { data: existingData, isLoading: isLoadingData } = useAttendeeDetail(
    isEditing ? attendeeId : null
  );
  
  const createMutation = useCreateAttendee();
  const updateMutation = useUpdateAttendee();

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

  // Reset form with loaded data when editing
  useEffect(() => {
    if (isEditing && existingData?.attendee) {
      form.reset({
        full_name: existingData.attendee.full_name,
        email: existingData.attendee.email,
        specialty: existingData.attendee.specialty || '',
        institution: existingData.attendee.institution || '',
        registration_status: existingData.attendee.registration_status || 'pending',
      });
    }
  }, [existingData, isEditing, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing) {
        // Update existing attendee
        await updateMutation.mutateAsync({
          attendeeId: attendeeId!,
          data: values,
        });
        toast({
          title: t('attendees.editAttendeeModal.success'),
          description: t('attendees.editAttendeeModal.successCode', { code: existingData.attendee.credential_code }),
        });
      } else {
        // Create new attendee
        const attendee = await createMutation.mutateAsync(values);
        toast({
          title: t('attendees.newAttendeeModal.success'),
          description: t('attendees.newAttendeeModal.successCode', { code: attendee.credential_code }),
        });
      }
      form.reset();
      onOpenChange(false);
    } catch {
      toast({
        title: t(isEditing ? 'attendees.editAttendeeModal.error' : 'attendees.newAttendeeModal.error'),
        variant: 'destructive',
      });
    }
  };

  const isLoading = isLoadingData || createMutation.isPending || updateMutation.isPending;

  // Show loading skeleton while fetching attendee data for edit
  if (isLoadingData && isEditing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('attendees.editAttendeeModal.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('attendees.editAttendeeModal.title')
              : t('attendees.newAttendeeModal.title')}
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="confirmed">{t('attendees.statusConfirmed')}</SelectItem>
                      <SelectItem value="pending">{t('attendees.statusPending')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {field.value === 'confirmed'
                      ? t('attendees.confirmedHint')
                      : t('attendees.pendingHint')}
                  </p>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? t(isEditing ? 'attendees.editAttendeeModal.saving' : 'attendees.newAttendeeModal.saving')
                : t(isEditing ? 'attendees.editAttendeeModal.save' : 'attendees.newAttendeeModal.save')}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
