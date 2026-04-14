import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { EventSettingsCard } from '@/components/admin/EventSettingsCard';

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

      <EventSettingsCard />
    </div>
  );
}
