import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QrCode, KeyRound, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';

export default function AttendeeLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loginWithCode, isAuthenticated, isAttendee } = useAuth();
  const { event, eventSlug } = useEvent();

  const [accessCode, setAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated as attendee
  if (isAuthenticated && isAttendee) {
    navigate(`/${eventSlug}/home`, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim() || accessCode.trim().length < 6) return;

    setIsSubmitting(true);
    try {
      await loginWithCode(accessCode.trim(), eventSlug);
      toast({
        title: t('auth.welcomeBack'),
        description: event?.name,
      });
      navigate(`/${eventSlug}/home`, { replace: true });
    } catch (err) {
      const errorKey = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
      const messages: Record<string, string> = {
        INVALID_CODE: t('auth.invalidCode'),
        EVENT_NOT_FOUND: t('auth.eventNotFound'),
        REGISTRATION_CANCELLED: t('auth.registrationCancelled'),
      };
      toast({
        variant: 'destructive',
        title: t('error'),
        description: messages[errorKey] || t('error'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Header gradient banner */}
        <div
          className="rounded-t-lg px-6 py-8 text-center"
          style={{
            background: 'linear-gradient(135deg, hsl(213 72% 36%) 0%, hsl(172 100% 36%) 100%)',
          }}
        >
          <h1 className="text-2xl font-bold text-white">
            {t('appName')}
          </h1>
          {event && (
            <>
              <p className="mt-2 text-base font-semibold text-white/90">
                {event.name}
              </p>
              {event.venue_name && (
                <p className="mt-1 text-sm text-white/70">
                  {event.venue_name}
                </p>
              )}
            </>
          )}
        </div>

        <Card className="rounded-t-none border-t-0">
          <CardHeader className="pb-4 pt-6">
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.accessCodePlaceholder')}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  maxLength={12}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXXXX"
                  className="pl-10 text-center text-lg font-mono tracking-widest uppercase"
                  autoFocus
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isSubmitting || accessCode.trim().length < 6}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  t('auth.login')
                )}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {t('auth.or')}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isSubmitting}
              >
                <QrCode className="mr-2 h-4 w-4" />
                {t('auth.scanQr')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
