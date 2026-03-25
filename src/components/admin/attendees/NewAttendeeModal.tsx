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
import { useCreateAttendee, useSendInvitations } from '@/hooks/useAdminAttendees';
import { useEvent } from '@/hooks/useEvent';

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
}

export function NewAttendeeModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation('admin');
  const createMutation = useCreateAttendee();
  const sendInvitationsMutation = useSendInvitations();
  const { event } = useEvent();

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

  const onSubmit = async (values: FormValues) => {
    try {
      const attendee = await createMutation.mutateAsync(values);
      
      // If status is confirmed, send invitation email
      if (values.registration_status === 'confirmed' && event?.id) {
        try {
          const result = await sendInvitationsMutation.mutateAsync([attendee.id]);
          toast({
            title: t('attendees.newAttendeeModal.success'),
            description: result.sent > 0
              ? t('attendees.invitationSent')
              : t('attendees.newAttendeeModal.successCode', { code: attendee.credential_code }),
          });
        } catch {
          // Attendee created but invitation failed
          toast({
            title: t('attendees.newAttendeeModal.success'),
            description: t('attendees.invitationFailed'),
          });
        }
      } else {
        toast({
          title: t('attendees.newAttendeeModal.success'),
          description: t('attendees.newAttendeeModal.successCode', { code: attendee.credential_code }),
        });
      }
      
      form.reset();
      onOpenChange(false);
    } catch {
      toast({
        title: t('attendees.newAttendeeModal.error'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('attendees.newAttendeeModal.title')}</DialogTitle>
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

            <Button type="submit" className="w-full" disabled={createMutation.isPending || sendInvitationsMutation.isPending}>
              {createMutation.isPending || sendInvitationsMutation.isPending
                ? t('attendees.newAttendeeModal.saving')
                : t('attendees.newAttendeeModal.save')}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
