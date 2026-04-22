import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { EventSettingsCard } from '@/components/admin/EventSettingsCard';
import { EventBrandingCard } from '@/components/admin/EventBrandingCard';
import { EventVisibilityCard } from '@/components/admin/EventVisibilityCard';
import { EventDetailsCard } from '@/components/admin/EventDetailsCard';
import { DangerZoneCard } from '@/components/admin/DangerZoneCard';

export default function EventConfig() {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6" />
          {t('settings.pageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.pageDescription')}
        </p>
      </div>

      <EventDetailsCard />
      <EventBrandingCard />
      <EventSettingsCard />
      <EventVisibilityCard />
      <DangerZoneCard />
    </div>
  );
}
