import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ProviderLogin() {
  const { t } = useTranslation('provider');
  const { eventSlug } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Check existing session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: provider } = await supabase
          .from('providers')
          .select('id, event_id, password_changed')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (provider) {
          const { data: event } = await supabase
            .from('events')
            .select('event_code')
            .eq('id', provider.event_id)
            .single();

          if (event?.event_code === eventSlug) {
            if (!(provider as any).password_changed) {
              navigate(`/${eventSlug}/provider/change-password`, { replace: true });
            } else {
              navigate(`/${eventSlug}/provider/dashboard`, { replace: true });
            }
          }
        }
      }
    };
    checkSession();
  }, [eventSlug, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !eventSlug) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) throw signInError;

      // Verify user is a provider for this event
      const { data: provider, error: provError } = await supabase
        .from('providers')
        .select('id, event_id, is_active, access_expires_at, password_changed')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (provError || !provider) {
        await supabase.auth.signOut();
        setError(t('invalidCredentials'));
        return;
      }

      // Check if active
      if (!provider.is_active) {
        await supabase.auth.signOut();
        setError(t('accountInactive'));
        return;
      }

      // Check expiry
      if (provider.access_expires_at && new Date(provider.access_expires_at) < new Date()) {
        const expiryDate = new Date(provider.access_expires_at).toLocaleDateString();
        await supabase.auth.signOut();
        setError(t('accessExpiredDate', { date: expiryDate }));
        return;
      }

      // Verify event matches
      const { data: event } = await supabase
        .from('events')
        .select('event_code')
        .eq('id', provider.event_id)
        .single();

      if (event?.event_code !== eventSlug) {
        await supabase.auth.signOut();
        setError(t('invalidCredentials'));
        return;
      }

      // Update login tracking
      await supabase
        .from('providers')
        .update({
          last_login: new Date().toISOString(),
          login_count: (provider as any).login_count ? (provider as any).login_count + 1 : 1,
        } as any)
        .eq('id', provider.id);

      // Log activity (fire-and-forget)
      const { providerPortalService } = await import('@/services/provider-portal.service');
      providerPortalService.logActivity('login', { email: email.trim() }).catch(() => {});

      // Check if password needs to be changed
      if (!(provider as any).password_changed) {
        navigate(`/${eventSlug}/provider/change-password`, { replace: true });
      } else {
        navigate(`/${eventSlug}/provider/dashboard`, { replace: true });
      }
    } catch {
      setError(t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/${eventSlug}/provider`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success(t('resetEmailSent'));
    } catch {
      setError(t('resetEmailError'));
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">{t('forgotPasswordTitle')}</CardTitle>
            <CardDescription>{t('forgotPasswordSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {resetSent ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">{t('resetEmailSentMessage')}</p>
                <Button variant="outline" onClick={() => { setShowForgotPassword(false); setResetSent(false); }} className="w-full">
                  {t('backToLogin')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <Label>{t('email')}</Label>
                  <Input
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    type="email"
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
                <Button type="submit" disabled={loading || !resetEmail.trim()} className="w-full bg-primary text-primary-foreground">
                  {loading ? t('sending') : t('sendResetLink')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForgotPassword(false)} className="w-full">
                  {t('backToLogin')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <Label>{t('email')}</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                type="email"
                autoFocus
              />
            </div>

            <div>
              <Label>{t('password')}</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" disabled={loading || !email.trim() || !password.trim()} className="w-full bg-primary text-primary-foreground">
              {loading ? t('loggingIn') : t('login')}
            </Button>

            <button
              type="button"
              onClick={() => { setShowForgotPassword(true); setError(''); setResetEmail(email); }}
              className="w-full text-sm text-primary hover:underline"
            >
              {t('forgotPassword')}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
