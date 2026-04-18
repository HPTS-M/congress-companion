import { Menu, Globe, Bell, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEvent, useEventSlug, useEventSettings } from '@/hooks/useEvent';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  onMenuOpen: () => void;
}

export function AppHeader({ onMenuOpen }: AppHeaderProps) {
  const { t, i18n } = useTranslation();
  const { t: tMessaging } = useTranslation('messaging');
  const { event } = useEvent();
  const { attendee } = useAuth();
  const navigate = useNavigate();
  const eventSlug = useEventSlug();
  const announcements = useUnreadAnnouncements(event?.id ?? '');
  const messages = useUnreadMessages(event?.id ?? '');
  const { headerLogoUrl } = useEventSettings();

  const toggleLanguage = (): void => {
    i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
  };

  const handleBellClick = (): void => {
    announcements.markAsSeen();
    navigate(`/${eventSlug}/announcements`);
  };

  const handleMessagingClick = (): void => {
    messages.markAsSeen();
    navigate(`/${eventSlug}/messaging`);
  };

  const showMessagingDot =
    messages.pendingInvites > 0 && messages.unreadMessages === 0;

  const logoSrc = headerLogoUrl || '/logo-acqfh-v2.jpg';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-3 md:h-16 md:px-4"
      style={{ background: 'linear-gradient(135deg, hsl(var(--header-start)), hsl(var(--header-end)))' }}
    >
      {/* Left — hamburger (mobile only) */}
      <Button variant="ghost" size="icon" onClick={onMenuOpen} className="text-white hover:bg-white/10 md:hidden">
        <Menu className="h-5 w-5" />
      </Button>
      {/* Spacer for desktop when hamburger is hidden */}
      <div className="hidden md:block w-10" />

      {/* Center — event info */}
      <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden px-2">
        <img src={logoSrc} alt="Logo" className="h-8 w-auto shrink-0" />
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
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10" onClick={handleBellClick} aria-label="Announcements">
          <Bell className="h-4 w-4" />
          {announcements.count > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {announcements.count > 99 ? '99+' : announcements.count}
            </span>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white hover:bg-white/10"
          onClick={handleMessagingClick}
          aria-label={tMessaging('headerTooltip')}
          title={tMessaging('headerTooltip')}
        >
          <MessageCircle className="h-4 w-4" />
          {messages.count > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {messages.count > 99 ? '99+' : messages.count}
            </span>
          )}
          {messages.count === 0 && showMessagingDot && (
            <span className="absolute right-1 top-1 flex h-2 w-2 items-center justify-center rounded-full bg-accent animate-pulse" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10 md:w-auto md:px-2" onClick={() => navigate(`/${eventSlug}/profile`)}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
            {attendee?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </span>
          <span className="hidden md:block ml-1 max-w-[100px] truncate text-xs text-white">
            {attendee?.full_name}
          </span>
        </Button>
      </div>
    </header>
  );
}
