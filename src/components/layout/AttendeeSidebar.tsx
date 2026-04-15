import {
  Home, Calendar, QrCode, Ticket, Building2, BarChart3,
  Users, FileText, Edit, MessageCircle, Bell, Star, Map, LogOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
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

const mainItems = [
  { key: 'home', icon: Home, path: '/home' },
  { key: 'agenda', icon: Calendar, path: '/agenda' },
  { key: 'checkin', icon: QrCode, path: '/checkin', requiresQr: true },
  { key: 'tickets', icon: Ticket, path: '/tickets' },
  { key: 'commercial', icon: Building2, path: '/commercial' },
  { key: 'polls', icon: BarChart3, path: '/polls' },
];

const secondaryItems = [
  { key: 'contacts', icon: Users, path: '/contacts' },
  { key: 'documents', icon: FileText, path: '/documents' },
  { key: 'notes', icon: Edit, path: '/notes' },
  { key: 'messaging', icon: MessageCircle, path: '/messaging' },
  { key: 'announcements', icon: Bell, path: '/announcements' },
  { key: 'ratings', icon: Star, path: '/ratings' },
  { key: 'venueMap', icon: Map, path: '/venue-map' },
];

export function AttendeeSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const eventSlug = useEventSlug();
  const { qrEnabled } = useEventSettings();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const filteredMain = mainItems.filter((item) => !item.requiresQr || qrEnabled);

  const handleLogout = async () => {
    await logout();
    navigate(`/${eventSlug}`);
  };

  return (
    <Sidebar collapsible="icon" className="hidden md:flex border-r border-border">
      <SidebarContent className="pt-16">
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && t('nav.home')?.split(' ')[0] ? 'Principal' : ''}</SidebarGroupLabel>
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
              {secondaryItems.map(({ key, icon: Icon, path }) => (
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
