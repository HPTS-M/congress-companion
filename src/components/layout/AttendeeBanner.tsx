import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

export function AttendeeBanner() {
  const { t } = useTranslation();
  const { attendee } = useAuth();

  return (
    <div className="fixed top-14 md:top-16 left-0 md:left-[var(--sidebar-width)] right-0 z-40 bg-primary px-4 py-3">
      <p className="text-lg font-bold text-primary-foreground">{attendee?.full_name}</p>
      <p className="text-sm text-primary-foreground/80">
        {attendee?.selected_package_id ? attendee.selected_package_id : t('home.packageFallback')}
      </p>
      {attendee?.registration_status === 'confirmed' && (
        <span className="absolute right-4 top-3 rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-foreground">
          {t('status.confirmed')}
        </span>
      )}
    </div>
  );
}
