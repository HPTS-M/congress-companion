import {
  Home, Calendar, QrCode, Ticket, Building2, BarChart3,
  Users, FileText, Edit, MessageCircle, Bell, Star, Map, LogOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useEventSlug, useEventSettings } from '@/hooks/useEvent';
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
  const { logout } = useAuth();
  const eventSlug = useEventSlug();
  const settings = useEventSettings();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const filteredMain = mainItems.filter((item) => !item.settingsKey || settings[item.settingsKey]);
  const filteredSecondary = secondaryItems.filter((item) => !item.settingsKey || settings[item.settingsKey]);

  const handleLogout = async () => {
    await logout();
    navigate(`/${eventSlug}`);
  };

  return (
    <Sidebar collapsible="icon" className="hidden md:flex border-r border-border">
      <SidebarContent className="pt-16">
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed ? 'Principal' : ''}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map(({ key, icon: Icon, path }) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/${eventSlug}${path}`}
                      end={path === '/home'}
                      className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded-md"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{t(`nav.${key}`)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed ? 'Más' : ''}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSecondary.map(({ key, icon: Icon, path }) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/${eventSlug}${path}`}
                      className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded-md"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{t(`nav.${key}`)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{t('logout')}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
