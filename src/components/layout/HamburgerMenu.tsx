import { FileText, Edit, MessageCircle, Bell, Star, LogOut, Users, Map, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEvent, useEventSlug, useEventSettings } from '@/hooks/useEvent';
import { usePrefetch } from '@/hooks/usePrefetch';
import { usePrefetchHandlers } from '@/hooks/usePrefetchHandlers';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface HamburgerMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsKey = 'contactsEnabled' | 'documentsEnabled' | 'notesEnabled' | 'messagingEnabled' | 'announcementsEnabled' | 'ratingsEnabled' | 'venueMapEnabled' | 'pollsEnabled';

const menuItems: Array<{ key: string; icon: typeof Users; path: string; settingsKey: SettingsKey }> = [
  { key: 'contacts', icon: Users, path: '/contacts', settingsKey: 'contactsEnabled' },
  { key: 'documents', icon: FileText, path: '/documents', settingsKey: 'documentsEnabled' },
  { key: 'notes', icon: Edit, path: '/notes', settingsKey: 'notesEnabled' },
  { key: 'messaging', icon: MessageCircle, path: '/messaging', settingsKey: 'messagingEnabled' },
  { key: 'announcements', icon: Bell, path: '/announcements', settingsKey: 'announcementsEnabled' },
  { key: 'ratings', icon: Star, path: '/ratings', settingsKey: 'ratingsEnabled' },
  { key: 'venueMap', icon: Map, path: '/venue-map', settingsKey: 'venueMapEnabled' },
  { key: 'polls', icon: BarChart3, path: '/polls', settingsKey: 'pollsEnabled' },
];

export function HamburgerMenu({ open, onOpenChange }: HamburgerMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, attendee } = useAuth();
  const eventSlug = useEventSlug();
  const settings = useEventSettings();
  const { event } = useEvent();
  const prefetch = usePrefetch(event?.id ?? '', attendee?.id);

  const visibleItems = menuItems.filter((item) => settings[item.settingsKey]);

  const handleNavigate = (path: string) => {
    navigate(`/${eventSlug}${path}`);
    onOpenChange(false);
  };

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
    navigate(`/${eventSlug}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-left text-lg font-bold text-foreground">
            <img src="/logo-250px.png" alt="Logo" className="h-7 w-auto" />
            {t('appName')}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col py-2">
          {visibleItems.map(({ key, icon: Icon, path }) => (
            <MenuItemButton
              key={key}
              tabKey={key}
              path={path}
              Icon={Icon}
              label={t(`nav.${key}`)}
              prefetch={prefetch}
              onNavigate={handleNavigate}
            />
          ))}

          <div className="mx-4 my-2 border-t border-border" />

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive transition-colors hover:bg-muted"
          >
            <LogOut className="h-5 w-5" />
            {t('logout')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MenuItemButtonProps {
  tabKey: string;
  path: string;
  Icon: typeof Users;
  label: string;
  prefetch: ReturnType<typeof usePrefetch>;
  onNavigate: (path: string) => void;
}

function MenuItemButton({ tabKey, path, Icon, label, prefetch, onNavigate }: MenuItemButtonProps) {
  const prefetchFn = (prefetch as Record<string, (() => Promise<unknown>) | undefined>)[tabKey];
  const handlers = usePrefetchHandlers(prefetchFn ?? (() => {}));
  return (
    <button
      onClick={() => onNavigate(path)}
      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      {...(prefetchFn ? handlers : {})}
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      {label}
    </button>
  );
}
