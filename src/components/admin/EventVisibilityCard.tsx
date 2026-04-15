import { useTranslation } from 'react-i18next';
import {
  Eye, Users, FileText, Edit, MessageCircle, Bell,
  Star, Map, BarChart3, Ticket, Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEvent } from '@/hooks/useEvent';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

const modules = [
  { key: 'contacts_enabled', icon: Users, i18nKey: 'contacts' },
  { key: 'documents_enabled', icon: FileText, i18nKey: 'documents' },
  { key: 'notes_enabled', icon: Edit, i18nKey: 'notes' },
  { key: 'messaging_enabled', icon: MessageCircle, i18nKey: 'messaging' },
  { key: 'announcements_enabled', icon: Bell, i18nKey: 'announcements' },
  { key: 'ratings_enabled', icon: Star, i18nKey: 'ratings' },
  { key: 'venue_map_enabled', icon: Map, i18nKey: 'venueMap' },
  { key: 'polls_enabled', icon: BarChart3, i18nKey: 'polls' },
  { key: 'tickets_enabled', icon: Ticket, i18nKey: 'tickets' },
  { key: 'commercial_enabled', icon: Building2, i18nKey: 'commercial' },
] as const;

export function EventVisibilityCard() {
  const { t } = useTranslation('admin');
  const { t: tNav } = useTranslation();
  const { event, eventSlug } = useEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const settings = (event?.settings ?? {}) as Record<string, unknown>;

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      if (!event) throw new Error('No event');
      const newSettings = { ...settings, [key]: value };
      const { error } = await supabase
        .from('events')
        .update({ settings: newSettings as unknown as Json })
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
          <Eye className="h-5 w-5" />
          {t('settings.visibility.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t('settings.visibility.description')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {modules.map(({ key, icon: Icon, i18nKey }) => {
            const enabled = settings[key] !== false;
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                    {tNav(`nav.${i18nKey}`)}
                  </Label>
                </div>
                <Switch
                  id={key}
                  checked={enabled}
                  disabled={updateSetting.isPending}
                  onCheckedChange={(checked) =>
                    updateSetting.mutate({ key, value: checked })
                  }
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
