import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Index() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [eventCode, setEventCode] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = eventCode.trim();
    if (!code) return;
    setIsNavigating(true);
    navigate(`/${code}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo area */}
        <img src="/logo-250px.png" alt="Health Plus Travels Events" className="mx-auto mb-8 h-20 w-auto" />

        <h1 className="mb-2 text-2xl font-bold text-foreground">
          {t('appName')}
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {t('auth.enterEventCode')}
        </p>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                placeholder={t('auth.eventCodePlaceholder')}
                className="text-center text-lg font-mono tracking-wide uppercase"
                autoFocus
                autoComplete="off"
                disabled={isNavigating}
              />
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isNavigating || !eventCode.trim()}
              >
                {isNavigating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {t('auth.accessEvent')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
