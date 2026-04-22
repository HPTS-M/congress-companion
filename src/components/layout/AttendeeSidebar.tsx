import {
  Home, Calendar, QrCode, Ticket, Building2, BarChart3,
  Users, FileText, Edit, MessageCircle, Bell, Star, Map, LogOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useEvent, useEventSlug, useEventSettings } from '@/hooks/useEvent';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePrefetch } from '@/hooks/usePrefetch';
import { usePrefetchHandlers } from '@/hooks/usePrefetchHandlers';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

type SettingsKey = 'qrEnabled' | 'contactsEnabled' | 'documentsEnabled' | 'notesEnabled' | 'messagingEnabled' | 'announcementsEnabled' | 'ratingsEnabled' | 'venueMapEnabled' | 'pollsEnabled' | 'ticketsEnabled' | 'commercialEnabled';

const mainItems: Array<{ key: string; icon: typeof Home; path: string; settingsKey?: SettingsKey }> = [
  { key: 'home', icon: Home, path: '/home' },
  { key: 'agenda', icon: Calendar, path: '/agenda' },
  { key: 'checkin', icon: QrCode, path: '/checkin', settingsKey: 'qrEnabled' },
  { key: 'tickets', icon: Ticket, path: '/tickets', settingsKey: 'ticketsEnabled' },
  { key: 'commercial', icon: Building2, path: '/commercial', settingsKey: 'commercialEnabled' },
  { key: 'polls', icon: BarChart3, path: '/polls', settingsKey: 'pollsEnabled' },
];

const secondaryItems: Array<{ key: string; icon: typeof Home; path: string; settingsKey?: SettingsKey }> = [
  { key: 'contacts', icon: Users, path: '/contacts', settingsKey: 'contactsEnabled' },
  { key: 'documents', icon: FileText, path: '/documents', settingsKey: 'documentsEnabled' },
  { key: 'notes', icon: Edit, path: '/notes', settingsKey: 'notesEnabled' },
  { key: 'messaging', icon: MessageCircle, path: '/messaging', settingsKey: 'messagingEnabled' },
  { key: 'announcements', icon: Bell, path: '/announcements', settingsKey: 'announcementsEnabled' },
  { key: 'ratings', icon: Star, path: '/ratings', settingsKey: 'ratingsEnabled' },
  { key: 'venueMap', icon: Map, path: '/venue-map', settingsKey: 'venueMapEnabled' },
];

export function AttendeeSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, attendee } = useAuth();
  const eventSlug = useEventSlug();
  const settings = useEventSettings();
  const { event } = useEvent();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const announcements = useUnreadAnnouncements(event?.id ?? '');
  const messages = useUnreadMessages(event?.id ?? '');
  const isOnline = useOnlineStatus();
  const prefetch = usePrefetch(event?.id ?? '', attendee?.id);

  const filteredMain = mainItems.filter((item) => !item.settingsKey || settings[item.settingsKey]);
  const filteredSecondary = secondaryItems.filter((item) => !item.settingsKey || settings[item.settingsKey]);

  const handleLogout = async () => {
    await logout();
    navigate(`/${eventSlug}`);
  };

  const renderBadge = (count: number) => {
    if (count <= 0) return null;
    if (collapsed) {
      return (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
      );
    }
    return (
      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  const renderOfflineDot = () => {
    if (isOnline) return null;
    if (collapsed) {
      return (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-background" />
      );
    }
    return (
      <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" aria-label={t('offlineBanner.headerDot')} />
    );
  };

  return (
    <Sidebar collapsible="icon" className="hidden md:flex border-r border-border">
      <SidebarContent className="pt-16 py-[6px] mt-[30px]">
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed ? 'Principal' : ''}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map(({ key, icon: Icon, path }) => (
                <SidebarRow
                  key={key}
                  tabKey={key}
                  to={`/${eventSlug}${path}`}
                  end={path === '/home'}
                  Icon={Icon}
                  label={t(`nav.${key}`)}
                  collapsed={collapsed}
                  prefetch={prefetch}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed ? 'Más' : ''}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSecondary.map(({ key, icon: Icon, path }) => {
                const isAnnouncements = key === 'announcements';
                const isMessaging = key === 'messaging';
                const handleClick = () => {
                  if (isAnnouncements) announcements.markAsSeen();
                  if (isMessaging) messages.markAsSeen();
                };
                const trailing = isAnnouncements
                  ? renderBadge(announcements.count)
                  : isMessaging
                  ? messages.count > 0
                    ? renderBadge(messages.count)
                    : renderOfflineDot()
                  : null;
                return (
                  <SidebarRow
                    key={key}
                    tabKey={key}
                    to={`/${eventSlug}${path}`}
                    Icon={Icon}
                    label={t(`nav.${key}`)}
                    collapsed={collapsed}
                    prefetch={prefetch}
                    onClick={handleClick}
                    trailing={trailing}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 mt-[5px]"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{t('logout')}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

interface SidebarRowProps {
  tabKey: string;
  to: string;
  end?: boolean;
  Icon: typeof Home;
  label: string;
  collapsed: boolean;
  prefetch: ReturnType<typeof usePrefetch>;
  onClick?: () => void;
  trailing?: React.ReactNode;
}

function SidebarRow({ tabKey, to, end, Icon, label, collapsed, prefetch, onClick, trailing }: SidebarRowProps) {
  const prefetchFn = (prefetch as Record<string, (() => Promise<unknown>) | undefined>)[tabKey];
  const handlers = usePrefetchHandlers(prefetchFn ?? (() => {}));
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={to}
          end={end}
          onClick={onClick}
          className="relative flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded-md"
          activeClassName="bg-primary/10 text-primary font-semibold"
          {...(prefetchFn ? handlers : {})}
        >
          <Icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{label}</span>}
          {trailing}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

