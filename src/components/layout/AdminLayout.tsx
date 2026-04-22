import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Calendar, FolderOpen, Building2,
  Ticket, Truck, Megaphone, ScanLine, BarChart3, LogOut, ArrowLeft, UserCheck,
  ListChecks, Settings,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import { AdminRoute } from '@/components/guards/AdminRoute';

/* Navigation items for admin sidebar – v2 sync */
const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { key: 'config', icon: Settings, path: 'config' },
  { key: 'users', icon: Users, path: 'users' },
  { key: 'agenda', icon: Calendar, path: 'agenda' },
  { key: 'documents', icon: FolderOpen, path: 'documents' },
  { key: 'sponsors', icon: Building2, path: 'sponsors' },
  { key: 'tickets', icon: Ticket, path: 'logistics' },
  { key: 'providers', icon: Truck, path: 'providers' },
  { key: 'communications', icon: Megaphone, path: 'communications' },
  { key: 'polls', icon: ListChecks, path: 'polls' },
  { key: 'checkinStaff', icon: ScanLine, path: 'checkin-staff' },
  { key: 'staff', icon: UserCheck, path: 'staff' },
  { key: 'reports', icon: BarChart3, path: 'reports' },
];

function AdminSidebar() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { event, eventSlug } = useEvent();

  const handleLogout = async () => {
    await logout();
    navigate(`/${eventSlug}/admin/login`, { replace: true });
  };

  return (
    <Sidebar className="border-r-0" style={{ '--sidebar-width': '240px' } as React.CSSProperties}>
      <SidebarHeader className="bg-[hsl(220,30%,15%)] px-4 py-4">
        <div className="text-lg font-bold text-white tracking-tight">Health Plus Travels Events</div>
        {event && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-slate-400 truncate">{event.name}</span>
            <Badge variant="outline" className="text-[10px] border-primary/50 text-primary-foreground bg-primary/20 shrink-0">
              Admin
            </Badge>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="bg-[hsl(220,30%,15%)]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/${eventSlug}/admin/${item.path}`}
                      end={item.path === 'dashboard'}
                      className="text-slate-300 hover:bg-white/10 hover:text-white"
                      activeClassName="bg-primary/20 text-white font-medium"
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      <span>{t(`nav.${item.key}`)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-[hsl(220,30%,15%)] border-t border-white/10 p-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/10"
          onClick={() => navigate(`/${eventSlug}/admin/profile`)}
        >
          <Settings className="mr-2 h-4 w-4" />
          {t('layout.profile')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/10"
          onClick={() => navigate(`/${eventSlug}/home`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('layout.backToApp')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-white/10"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('layout.logout')}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout() {
  return (
    <AdminRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AdminSidebar />
          <main className="flex-1 overflow-auto">
            <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-4 md:hidden">
              <SidebarTrigger />
              <span className="ml-3 font-semibold text-foreground">Admin</span>
            </header>
            <div className="p-4 md:p-6 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </AdminRoute>
  );
}
