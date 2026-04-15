import { useTranslation } from 'react-i18next';

import { Calendar, MapPin, Users, Home as HomeIcon, Ticket, Building2, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEvent, useEventSettings, useEventSlug } from '@/hooks/useEvent';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useMemo } from 'react';

type SettingsKey = 'ticketsEnabled' | 'commercialEnabled' | 'pollsEnabled';

const quickAccessItems: Array<{ key: string; icon: typeof HomeIcon; path: string; settingsKey?: SettingsKey }> = [
  { key: 'home', icon: HomeIcon, path: '/home' },
  { key: 'agenda', icon: Calendar, path: '/agenda' },
  { key: 'tickets', icon: Ticket, path: '/tickets', settingsKey: 'ticketsEnabled' },
  { key: 'commercial', icon: Building2, path: '/commercial', settingsKey: 'commercialEnabled' },
  { key: 'polls', icon: BarChart3, path: '/polls', settingsKey: 'pollsEnabled' },
];

export default function Home() {
  const { t, i18n } = useTranslation();
  const { attendee } = useAuth();
  const { event } = useEvent();
  const settings = useEventSettings();
  const eventSlug = useEventSlug();
  const { bannerUrl } = settings;

  const dateLocale = i18n.language === 'es' ? es : enUS;
  const startDate = event?.start_date ? format(new Date(event.start_date), 'dd MMM yyyy', { locale: dateLocale }) : '';
  const endDate = event?.end_date ? format(new Date(event.end_date), 'dd MMM yyyy', { locale: dateLocale }) : '';

  const bannerSrc = bannerUrl || '/logo-congreso.png';

  const visibleItems = useMemo(
    () => quickAccessItems.filter((item) => !item.settingsKey || settings[item.settingsKey]),
    [settings],
  );

  return (
    <div className="flex flex-col">
      {/* Top Banner */}
      <div className="relative bg-primary px-4 py-5">
        <p className="text-lg font-bold text-primary-foreground">{attendee?.full_name}</p>
        <p className="text-sm text-primary-foreground/80">
          {attendee?.selected_package_id ? attendee.selected_package_id : t('home.packageFallback')}
        </p>
        {attendee?.registration_status === 'confirmed' && (
          <span className="absolute right-4 top-5 rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-foreground">
            {t('status.confirmed')}
          </span>
        )}
      </div>

      {/* Quick Access Icons */}
      <div className="mx-4 mt-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">{t('home.quickAccess')}</h2>
        <div className="grid grid-cols-5 gap-2">
          {visibleItems.map(({ key, icon: Icon, path }) => (
            <Link
              key={key}
              to={`/${eventSlug}${path}`}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <span className="text-center text-[11px] font-medium leading-tight text-foreground">
                {t(`nav.${key}`)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* QR Card */}
      <div className="mx-4 mt-4 flex flex-col items-center rounded-lg bg-card px-6 py-8 shadow-md">
        <img
          src={bannerSrc}
          alt="Logo Congreso"
          className="h-48 w-auto object-contain"
        />
      </div>

      {/* Event Info */}
      <div className="mx-4 mt-6 mb-6">
        <h2 className="mb-3 text-base font-semibold text-foreground">{t('home.eventInfo')}</h2>

        <div className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t('home.dateRange', { start: startDate, end: endDate })}</span>
          </div>

          {event?.venue_name && (
            <div className="flex items-center gap-3 text-sm text-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{event.venue_name}{event.venue_address ? `, ${event.venue_address}` : ''}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm text-foreground">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t('home.attendeeCount', { count: event?.max_attendees ?? 0 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
