import { Home, Calendar, QrCode, Ticket, Building2, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/components/NavLink';
import { useEventSlug, useEventSettings } from '@/hooks/useEvent';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

type SettingsKey = 'qrEnabled' | 'ticketsEnabled' | 'commercialEnabled' | 'pollsEnabled';

const allTabs: Array<{ key: string; icon: typeof Home; path: string; settingsKey?: SettingsKey }> = [
  { key: 'home', icon: Home, path: '/home' },
  { key: 'agenda', icon: Calendar, path: '/agenda' },
  { key: 'checkin', icon: QrCode, path: '/checkin', settingsKey: 'qrEnabled' },
  { key: 'tickets', icon: Ticket, path: '/tickets', settingsKey: 'ticketsEnabled' },
  { key: 'commercial', icon: Building2, path: '/commercial', settingsKey: 'commercialEnabled' },
  { key: 'polls', icon: BarChart3, path: '/polls', settingsKey: 'pollsEnabled' },
];

export function BottomNav() {
  const { t } = useTranslation();
  const eventSlug = useEventSlug();
  const settings = useEventSettings();

  const tabs = useMemo(
    () => allTabs.filter((tab) => !tab.settingsKey || settings[tab.settingsKey]),
    [settings],
  );

  return (
    <nav className="fixed top-[6.75rem] md:top-[7rem] left-0 md:left-[var(--sidebar-width)] right-0 z-40 flex h-16 items-center justify-around border-b border-border bg-background">
      {tabs.map(({ key, icon: Icon, path }) => (
        <NavLink
          key={key}
          to={`/${eventSlug}${path}`}
          className="flex flex-col items-center gap-0.5 px-1 py-1.5 text-muted-foreground"
          activeClassName="text-primary"
        >
          <Icon className="h-5 w-5" />
          <span className="text-[11px] font-medium leading-tight">{t(`nav.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
