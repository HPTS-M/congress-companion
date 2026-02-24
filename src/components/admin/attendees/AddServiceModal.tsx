import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAddService } from '@/hooks/useAdminAttendees';

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  service_type: z.string().min(1, 'Required'),
  scheduled_date: z.string().optional().or(z.literal('')),
  valid_from: z.string().optional().or(z.literal('')),
  valid_until: z.string().optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendeeId: string;
}

export function AddServiceModal({ open, onOpenChange, attendeeId }: Props) {
  const { t } = useTranslation('admin');
  const addMutation = useAddService();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      service_type: 'transport',
      scheduled_date: '',
      valid_from: '',
      valid_until: '',
      description: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await addMutation.mutateAsync({
        attendeeId,
        data: {
          name: values.name,
          service_type: values.service_type,
          scheduled_date: values.scheduled_date || undefined,
          valid_from: values.valid_from || undefined,
          valid_until: values.valid_until || undefined,
          description: values.description || undefined,
        },
      });
      toast({ title: t('attendees.addServiceModal.success') });
      form.reset();
      onOpenChange(false);
    } catch {
      toast({ title: t('attendees.addServiceModal.error'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('attendees.addServiceModal.title')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('attendees.addServiceModal.serviceName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('attendees.addServiceModal.serviceNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('attendees.addServiceModal.category')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="transport">{t('attendees.addServiceModal.categoryTransport')}</SelectItem>
                      <SelectItem value="food">{t('attendees.addServiceModal.categoryFood')}</SelectItem>
                      <SelectItem value="tour">{t('attendees.addServiceModal.categoryTour')}</SelectItem>
                      <SelectItem value="special">{t('attendees.addServiceModal.categorySpecial')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduled_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('attendees.addServiceModal.validDate')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('attendees.addServiceModal.validFrom')}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('attendees.addServiceModal.validTo')}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('attendees.addServiceModal.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('attendees.addServiceModal.descriptionPlaceholder')}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={addMutation.isPending}>
              {addMutation.isPending
                ? t('attendees.addServiceModal.saving')
                : t('attendees.addServiceModal.save')}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
