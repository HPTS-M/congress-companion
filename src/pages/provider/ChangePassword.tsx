import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function ProviderChangePassword() {
  const { t } = useTranslation('provider');
  const { eventSlug } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = password.length >= 8 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Mark password as changed
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('providers')
          .update({ password_changed: true } as any)
          .eq('user_id', session.user.id);
      }

      navigate(`/${eventSlug}/provider/dashboard`, { replace: true });
    } catch {
      setError(t('changePasswordError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">{t('changePasswordTitle')}</CardTitle>
          <CardDescription>{t('changePasswordSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t('newPassword')}</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoFocus
              />
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-muted-foreground mt-1">{t('passwordMinLength')}</p>
              )}
            </div>

            <div>
              <Label>{t('confirmPassword')}</Label>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                type="password"
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-destructive mt-1">{t('passwordMismatch')}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" disabled={loading || !isValid} className="w-full bg-primary text-primary-foreground">
              {loading ? t('saving') : t('changePasswordButton')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
