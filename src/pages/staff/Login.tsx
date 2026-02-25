import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { adminStaffService } from '@/services/admin-staff.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn } from 'lucide-react';

export default function StaffLogin() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const { event, eventSlug } = useEvent();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setLoading(true);
    setError('');

    try {
      const { userId } = await loginAdmin(email, password);

      // Verify this user is a staff member for this event
      const staffRecord = await adminStaffService.getStaffByUserId(userId, event.id);
      if (!staffRecord) {
        setError(t('staffPortal.noAccess'));
        setLoading(false);
        return;
      }

      navigate(`/${eventSlug}/staff/checkin`, { replace: true });
    } catch {
      setError(t('staffPortal.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold text-foreground">
            {t('staffPortal.title')}
          </CardTitle>
          <CardDescription>
            {event?.name ?? ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('staffPortal.email')}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('staffPortal.emailPlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('staffPortal.password')}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('staffPortal.passwordPlaceholder')}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? t('staffPortal.loggingIn') : t('staffPortal.login')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
