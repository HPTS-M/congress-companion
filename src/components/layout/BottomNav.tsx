import { Home, Calendar, QrCode, Ticket, Building2, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/components/NavLink';
import { useEventSlug, useEventSettings } from '@/hooks/useEvent';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

const allTabs = [
  { key: 'home', icon: Home, path: '/home' },
  { key: 'agenda', icon: Calendar, path: '/agenda' },
  { key: 'checkin', icon: QrCode, path: '/checkin', requiresQr: true },
  { key: 'tickets', icon: Ticket, path: '/tickets' },
  { key: 'commercial', icon: Building2, path: '/commercial' },
  { key: 'polls', icon: BarChart3, path: '/polls' },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  const eventSlug = useEventSlug();
  const { qrEnabled } = useEventSettings();

  const tabs = useMemo(
    () => allTabs.filter((tab) => !tab.requiresQr || qrEnabled),
    [qrEnabled],
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background">
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
