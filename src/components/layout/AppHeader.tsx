import { Menu, Globe, Bell, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEvent, useEventSlug } from '@/hooks/useEvent';
import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  onMenuOpen: () => void;
}

export function AppHeader({ onMenuOpen }: AppHeaderProps) {
  const { t, i18n } = useTranslation();
  const { event } = useEvent();
  const navigate = useNavigate();
  const eventSlug = useEventSlug();
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-3 md:h-16 md:px-4"
      style={{ background: 'linear-gradient(135deg, hsl(var(--header-start)), hsl(var(--header-end)))' }}
    >
      {/* Left — hamburger */}
      <Button variant="ghost" size="icon" onClick={onMenuOpen} className="text-white hover:bg-white/10">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Center — event info */}
      <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden px-2">
        <img src="/logo-acqfh-v2.jpg" alt="Logo" className="h-8 w-auto shrink-0" />
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-bold text-white md:text-base">{event?.name}</p>
          <p className="truncate text-xs text-white/70">{event?.venue_name}</p>
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" onClick={toggleLanguage} className="text-white hover:bg-white/10">
          <Globe className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate(`/${eventSlug}/profile`)}>
          <User className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
