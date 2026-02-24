import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Truck } from 'lucide-react';
import { providerPortalService } from '@/services/provider-portal.service';

export default function ProviderLogin() {
  const { t } = useTranslation('provider');
  const { eventSlug } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check existing session
  useEffect(() => {
    const session = providerPortalService.getSession();
    if (session && session.event_code === eventSlug) {
      navigate(`/${eventSlug}/provider/dashboard`, { replace: true });
    }
  }, [eventSlug, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !eventSlug) return;

    setLoading(true);
    setError('');

    try {
      await providerPortalService.login(code.trim(), eventSlug);
      navigate(`/${eventSlug}/provider/dashboard`, { replace: true });
    } catch {
      setError(t('invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t('accessCode')}</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t('codePlaceholder')}
                className="font-mono uppercase tracking-widest text-center text-lg"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" disabled={loading || !code.trim()} className="w-full bg-primary text-primary-foreground">
              {loading ? t('loggingIn') : t('login')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
