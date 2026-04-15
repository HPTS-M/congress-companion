import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useEvent } from '@/hooks/useEvent';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

interface BrandingSlotProps {
  label: string;
  description: string;
  currentUrl: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  uploading: boolean;
}

function BrandingSlot({ label, description, currentUrl, onUpload, onRemove, uploading }: BrandingSlotProps) {
  const { t } = useTranslation('admin');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>

      {currentUrl ? (
        <div className="relative inline-block">
          <img
            src={currentUrl}
            alt={label}
            className="h-24 max-w-[200px] rounded-md border border-border object-contain bg-muted p-1"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 h-6 w-6"
            onClick={onRemove}
            disabled={uploading}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <label className="flex h-24 w-48 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted">
          <Upload className="h-5 w-5" />
          <span className="text-xs">{t('settings.branding.selectImage')}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}

export function EventBrandingCard() {
  const { t } = useTranslation('admin');
  const { event, eventSlug } = useEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const settings = (event?.settings ?? {}) as Record<string, unknown>;
  const bannerUrl = (settings.banner_url as string) || '';
  const headerLogoUrl = (settings.header_logo_url as string) || '';

  const updateSettings = async (patch: Record<string, unknown>) => {
    if (!event) throw new Error('No event');
    const newSettings = { ...settings, ...patch };
    const { error } = await supabase
      .from('events')
      .update({ settings: newSettings as unknown as Json })
      .eq('id', event.id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['event', eventSlug] });
  };

  const uploadImage = async (file: File, key: 'banner_url' | 'header_logo_url') => {
    if (!event) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
      const fileName = key === 'banner_url' ? `banner.${ext}` : `header-logo.${ext}`;
      const path = `${event.id}/branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('event-sponsors')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: signedData, error: signError } = await supabase.storage
        .from('event-sponsors')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
      if (signError || !signedData?.signedUrl) throw signError || new Error('No URL');

      await updateSettings({ [key]: signedData.signedUrl });
      toast({ title: t('settings.saved') });
    } catch {
      toast({ title: t('settings.error'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (key: 'banner_url' | 'header_logo_url') => {
    setUploading(true);
    try {
      await updateSettings({ [key]: null });
      toast({ title: t('settings.saved') });
    } catch {
      toast({ title: t('settings.error'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Image className="h-5 w-5" />
          {t('settings.branding.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <BrandingSlot
          label={t('settings.branding.banner')}
          description={t('settings.branding.bannerDescription')}
          currentUrl={bannerUrl}
          onUpload={(file) => uploadImage(file, 'banner_url')}
          onRemove={() => removeImage('banner_url')}
          uploading={uploading}
        />
        <BrandingSlot
          label={t('settings.branding.headerLogo')}
          description={t('settings.branding.headerLogoDescription')}
          currentUrl={headerLogoUrl}
          onUpload={(file) => uploadImage(file, 'header_logo_url')}
          onRemove={() => removeImage('header_logo_url')}
          uploading={uploading}
        />
      </CardContent>
    </Card>
  );
}
