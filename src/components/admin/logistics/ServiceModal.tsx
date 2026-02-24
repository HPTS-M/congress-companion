import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ServiceCatalogRow } from '@/services/admin-logistics.service';

const schema = z.object({
  name: z.string().min(1),
  service_type: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormValues) => Promise<void>;
  service?: ServiceCatalogRow | null;
  isSaving: boolean;
}

export function ServiceModal({ open, onClose, onSave, service, isSaving }: Props) {
  const { t } = useTranslation('admin');
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      service_type: 'transport',
      description: '',
      location: '',
      valid_from: '',
      valid_until: '',
    },
  });

  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        service_type: service.service_type,
        description: service.description ?? '',
        location: service.location ?? '',
        valid_from: service.valid_from ?? '',
        valid_until: service.valid_until ?? '',
      });
    } else {
      form.reset({
        name: '',
        service_type: 'transport',
        description: '',
        location: '',
        valid_from: '',
        valid_until: '',
      });
    }
  }, [service, form]);

  const handleSubmit = async (data: FormValues) => {
    await onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {service ? t('logistics.editTitle') : t('logistics.newTitle')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('logistics.fieldName')}</FormLabel>
                <FormControl><Input {...field} placeholder={t('logistics.fieldNamePlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="service_type" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('logistics.fieldType')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="transport">{t('logistics.typeTransport')}</SelectItem>
                    <SelectItem value="food">{t('logistics.typeFood')}</SelectItem>
                    <SelectItem value="tour">{t('logistics.typeTour')}</SelectItem>
                    <SelectItem value="special">{t('logistics.typeSpecial')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('logistics.fieldLocation')}</FormLabel>
                <FormControl><Input {...field} placeholder={t('logistics.fieldLocationPlaceholder')} /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="valid_from" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('logistics.fieldFrom')}</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="valid_until" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('logistics.fieldUntil')}</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('logistics.fieldDescription')}</FormLabel>
                <FormControl><Textarea {...field} placeholder={t('logistics.fieldDescriptionPlaceholder')} rows={3} /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('sponsors.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground">
                {isSaving ? t('sponsors.saving') : t('sponsors.save')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
