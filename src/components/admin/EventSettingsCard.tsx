import { useTranslation } from 'react-i18next';
import { Settings, QrCode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEvent } from '@/hooks/useEvent';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function EventSettingsCard() {
  const { t } = useTranslation('admin');
  const { event, eventSlug } = useEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const settings = (event?.settings ?? {}) as Record<string, unknown>;
  const qrEnabled = settings.qr_enabled !== false;

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      if (!event) throw new Error('No event');
      const newSettings = { ...settings, [key]: value };
      const { error } = await supabase
        .from('events')
        .update({ settings: newSettings })
        .eq('id', event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventSlug] });
      toast({ title: t('settings.saved') });
    },
    onError: () => {
      toast({ title: t('settings.error'), variant: 'destructive' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" />
          {t('settings.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <QrCode className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="qr-toggle" className="text-sm font-medium">
                {t('settings.qrEnabled')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.qrEnabledDescription')}
              </p>
            </div>
          </div>
          <Switch
            id="qr-toggle"
            checked={qrEnabled}
            disabled={updateSetting.isPending}
            onCheckedChange={(checked) =>
              updateSetting.mutate({ key: 'qr_enabled', value: checked })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
