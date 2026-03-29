import { FileText, Edit, MessageCircle, Bell, Star, User, LogOut, Users, Map } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEventSlug } from '@/hooks/useEvent';
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

const menuItems = [
  { key: 'contacts', icon: Users, path: '/contacts' },
  { key: 'documents', icon: FileText, path: '/documents' },
  { key: 'notes', icon: Edit, path: '/notes' },
  { key: 'messaging', icon: MessageCircle, path: '/messaging' },
  { key: 'announcements', icon: Bell, path: '/announcements' },
  { key: 'ratings', icon: Star, path: '/ratings' },
  { key: 'profile', icon: User, path: '/profile' },
  { key: 'venueMap', icon: Map, path: '/venue-map' },
] as const;

export function HamburgerMenu({ open, onOpenChange }: HamburgerMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const eventSlug = useEventSlug();

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
          {menuItems.map(({ key, icon: Icon, path }) => (
            <button
              key={key}
              onClick={() => handleNavigate(path)}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              {t(`nav.${key}`)}
            </button>
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
