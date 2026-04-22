import { Home, Calendar, QrCode, Ticket, Building2, BarChart3, MessageCircle, Megaphone, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/components/NavLink';
import { useEvent, useEventSlug, useEventSettings } from '@/hooks/useEvent';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import { useAuth } from '@/hooks/useAuth';
import { usePrefetch, type PrefetchKey } from '@/hooks/usePrefetch';
import { usePrefetchHandlers } from '@/hooks/usePrefetchHandlers';
import { useMemo } from 'react';

type SettingsKey =
  | 'qrEnabled'
  | 'ticketsEnabled'
  | 'commercialEnabled'
  | 'pollsEnabled'
  | 'messagingEnabled'
  | 'announcementsEnabled'
  | 'contactsEnabled';

interface NavTab {
  key: string;
  icon: typeof Home;
  path: string;
  settingsKey?: SettingsKey;
  /** Lower = higher priority. Mobile shows the top N enabled tabs. */
  priority: number;
}

const MAX_MOBILE_TABS = 5;

// Mobile-first priority order. Chat (messaging) is high-priority because it's
// a frequent attendee action; we never want it buried in the hamburger menu.
const allTabs: NavTab[] = [
  { key: 'home', icon: Home, path: '/home', priority: 1 },
  { key: 'agenda', icon: Calendar, path: '/agenda', priority: 2 },
  { key: 'messaging', icon: MessageCircle, path: '/messaging', settingsKey: 'messagingEnabled', priority: 3 },
  { key: 'checkin', icon: QrCode, path: '/checkin', settingsKey: 'qrEnabled', priority: 4 },
  { key: 'tickets', icon: Ticket, path: '/tickets', settingsKey: 'ticketsEnabled', priority: 5 },
  { key: 'commercial', icon: Building2, path: '/commercial', settingsKey: 'commercialEnabled', priority: 6 },
  { key: 'polls', icon: BarChart3, path: '/polls', settingsKey: 'pollsEnabled', priority: 7 },
  { key: 'announcements', icon: Megaphone, path: '/announcements', settingsKey: 'announcementsEnabled', priority: 8 },
  { key: 'contacts', icon: Users, path: '/contacts', settingsKey: 'contactsEnabled', priority: 9 },
];

export function BottomNav() {
  const { t } = useTranslation();
  const eventSlug = useEventSlug();
  const settings = useEventSettings();
  const { event } = useEvent();
  const eventId = event?.id ?? '';
  const { attendee } = useAuth();
  const prefetch = usePrefetch(eventId, attendee?.id);

  const messages = useUnreadMessages(eventId);
  const announcements = useUnreadAnnouncements(eventId);

  const tabs = useMemo(
    () =>
      allTabs
        .filter((tab) => !tab.settingsKey || settings[tab.settingsKey])
        .sort((a, b) => a.priority - b.priority)
        .slice(0, MAX_MOBILE_TABS),
    [settings],
  );

  const getBadge = (key: string): { count: number; label: string } | null => {
    if (key === 'messaging' && messages.count > 0) {
      return { count: messages.count, label: t('nav.messaging') };
    }
    if (key === 'announcements' && announcements.count > 0) {
      return { count: announcements.count, label: t('nav.announcements') };
    }
    return null;
  };

  return (
    <nav
      className="fixed top-14 left-0 right-0 z-40 flex items-center justify-around border-b border-border bg-background md:hidden"
      style={{ minHeight: '56px' }}
    >
      {tabs.map(({ key, icon: Icon, path }) => {
        const badge = getBadge(key);
        const display = badge ? (badge.count > 9 ? '9+' : String(badge.count)) : null;
        return (
          <NavTab
            key={key}
            tabKey={key}
            to={`/${eventSlug}${path}`}
            Icon={Icon}
            label={t(`nav.${key}`)}
            ariaLabel={badge ? `${badge.label} (${badge.count})` : undefined}
            display={display}
            prefetch={prefetch}
          />
        );
      })}
    </nav>
  );
}

interface NavTabProps {
  tabKey: string;
  to: string;
  Icon: typeof Home;
  label: string;
  ariaLabel?: string;
  display: string | null;
  prefetch: ReturnType<typeof usePrefetch>;
}

/**
 * Inner tab component — required so we can call `usePrefetchHandlers` (a hook)
 * once per tab instead of inside the `tabs.map(...)` loop in the parent.
 */
function NavTab({ tabKey, to, Icon, label, ariaLabel, display, prefetch }: NavTabProps) {
  const prefetchFn = (prefetch as Record<string, (() => Promise<unknown>) | undefined>)[tabKey];
  const handlers = usePrefetchHandlers(prefetchFn ?? (() => {}));

  return (
    <NavLink
      to={to}
      className="relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-muted-foreground"
      activeClassName="text-primary"
      aria-label={ariaLabel}
      {...(prefetchFn ? handlers : {})}
    >
      <span className="relative">
        <Icon className="h-6 w-6" />
        {display && (
          <span
            className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background"
            aria-hidden="true"
          >
            {display}
          </span>
        )}
      </span>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
    </NavLink>
  );
}

