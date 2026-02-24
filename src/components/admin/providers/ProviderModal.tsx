import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { adminProvidersService, type ProviderRow, type ProviderForm } from '@/services/admin-providers.service';

const schema = z.object({
  company_name: z.string().min(1).max(200),
  category: z.string().min(1),
  contact_name: z.string().max(200).optional(),
  contact_email: z.string().email().max(255).optional().or(z.literal('')),
  contact_phone: z.string().max(50).optional(),
  access_code: z.string().min(4).max(20),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: ProviderForm) => Promise<void>;
  provider: ProviderRow | null;
  isSaving: boolean;
}

const CATEGORIES = ['transport', 'food', 'tour', 'special'] as const;

export function ProviderModal({ open, onClose, onSave, provider, isSaving }: Props) {
  const { t } = useTranslation('admin');

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: '',
      category: 'transport',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      access_code: adminProvidersService.generateAccessCode(),
    },
  });

  useEffect(() => {
    if (provider) {
      reset({
        company_name: provider.company_name,
        category: provider.category,
        contact_name: provider.contact_name ?? '',
        contact_email: provider.contact_email ?? '',
        contact_phone: provider.contact_phone ?? '',
        access_code: provider.access_code,
      });
    } else {
      reset({
        company_name: '',
        category: 'transport',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        access_code: adminProvidersService.generateAccessCode(),
      });
    }
  }, [provider, reset]);

  const onSubmit = async (data: FormData) => {
    await onSave({
      company_name: data.company_name,
      category: data.category,
      contact_name: data.contact_name,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      access_code: data.access_code,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {provider ? t('providers.editTitle') : t('providers.newTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>{t('providers.fieldCompany')} *</Label>
            <Input {...register('company_name')} placeholder={t('providers.fieldCompanyPlaceholder')} />
            {errors.company_name && <p className="text-xs text-destructive mt-1">{t('providers.companyRequired')}</p>}
          </div>

          <div>
            <Label>{t('providers.fieldCategory')} *</Label>
            <Select value={watch('category')} onValueChange={(v) => setValue('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{t(`logistics.type${c.charAt(0).toUpperCase() + c.slice(1)}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('providers.fieldContactName')}</Label>
            <Input {...register('contact_name')} placeholder={t('providers.fieldContactNamePlaceholder')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('providers.fieldEmail')}</Label>
              <Input {...register('contact_email')} type="email" placeholder="email@ejemplo.com" />
            </div>
            <div>
              <Label>{t('providers.fieldPhone')}</Label>
              <Input {...register('contact_phone')} placeholder="+57 300..." />
            </div>
          </div>

          <div>
            <Label>{t('providers.fieldAccessCode')}</Label>
            <Input {...register('access_code')} className="font-mono uppercase tracking-widest" />
            <p className="text-xs text-muted-foreground mt-1">{t('providers.accessCodeHint')}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('sponsors.cancel')}</Button>
            <Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground">
              {isSaving ? t('sponsors.saving') : t('sponsors.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
