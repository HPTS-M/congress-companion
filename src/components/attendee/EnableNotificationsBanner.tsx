import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { requestPushPermissionAndSubscribe } from '@/hooks/usePushSubscription';

const DISMISS_KEY = 'push_banner_dismissed_v1';

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function EnableNotificationsBanner() {
  const { t } = useTranslation('announcements');
  const { attendee } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!isPushSupported()) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  if (permission === 'unsupported') return null;
  if (permission === 'granted') return null;

  if (permission === 'denied') {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground dark:bg-slate-800/60">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="leading-snug">{t('notifications.blocked')}</p>
      </div>
    );
  }

  if (dismissed) return null;

  const handleEnable = async () => {
    if (!attendee?.id || !attendee?.event_id) return;
    setBusy(true);
    try {
      const result = await requestPushPermissionAndSubscribe(attendee.id, attendee.event_id);
      setPermission(result);
      if (result === 'granted') {
        toast.success(t('notifications.enabled'));
      } else if (result === 'denied') {
        toast.error(t('notifications.blocked'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 dark:bg-primary/10">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{t('notifications.title')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('notifications.description')}</p>
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={handleEnable} disabled={busy} className="h-8">
            {t('notifications.enableButton')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 text-muted-foreground"
          >
            {t('notifications.notNow')}
          </Button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label={t('notifications.notNow')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
