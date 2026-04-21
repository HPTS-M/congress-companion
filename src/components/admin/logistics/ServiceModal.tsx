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
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
}).refine(
  (d) => {
    if (!d.starts_at && !d.ends_at) return true;
    if (d.starts_at && d.ends_at) return new Date(d.ends_at) > new Date(d.starts_at);
    return false;
  },
  { message: 'INVALID_RANGE', path: ['ends_at'] },
);

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; service_type: string; description?: string; location?: string; starts_at?: string | null; ends_at?: string | null }) => Promise<void>;
  service?: ServiceCatalogRow | null;
  isSaving: boolean;
}

// Convert ISO timestamptz → 'YYYY-MM-DDTHH:mm' for datetime-local input
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert local input → ISO timestamptz
function localInputToIso(local: string | undefined): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
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
      starts_at: '',
      ends_at: '',
    },
  });

  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        service_type: service.service_type,
        description: service.description ?? '',
        location: service.location ?? '',
        starts_at: isoToLocalInput(service.starts_at),
        ends_at: isoToLocalInput(service.ends_at),
      });
    } else {
      form.reset({
        name: '',
        service_type: 'transport',
        description: '',
        location: '',
        starts_at: '',
        ends_at: '',
      });
    }
  }, [service, form]);

  const handleSubmit = async (data: FormValues) => {
    try {
      await onSave({
        name: data.name,
        service_type: data.service_type,
        description: data.description,
        location: data.location,
        starts_at: localInputToIso(data.starts_at),
        ends_at: localInputToIso(data.ends_at),
      });
      onClose();
    } catch {
      // keep modal open on error (e.g. duplicate name)
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="starts_at" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('logistics.fieldStartsAt', { defaultValue: 'Inicio del servicio' })}</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ends_at" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('logistics.fieldEndsAt', { defaultValue: 'Fin del servicio' })}</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  {form.formState.errors.ends_at?.message === 'INVALID_RANGE' && (
                    <p className="text-xs text-destructive">
                      {t('logistics.invalidRange', { defaultValue: 'La hora de fin debe ser posterior a la de inicio.' })}
                    </p>
                  )}
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
