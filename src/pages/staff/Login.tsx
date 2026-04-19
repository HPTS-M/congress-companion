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
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function StaffLogin() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const { event, eventSlug } = useEvent();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockReason, setBlockReason] = useState<'pending' | 'suspended' | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setLoading(true);
    setError('');

    try {
      const { userId } = await loginAdmin(email, password);

      const staffRecord = await adminStaffService.getStaffByUserId(userId, event.id);
      if (!staffRecord) {
        await supabase.auth.signOut();
        setError(t('staffPortal.noAccess'));
        setLoading(false);
        return;
      }

      // Status checks
      if (staffRecord.invitation_status === 'pending') {
        await supabase.auth.signOut();
        setBlockReason('pending');
        setLoading(false);
        return;
      }
      if (staffRecord.invitation_status === 'active' && staffRecord.is_active === false) {
        await supabase.auth.signOut();
        setBlockReason('suspended');
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

      <AlertDialog open={!!blockReason} onOpenChange={(o) => !o && setBlockReason(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockReason === 'pending'
                ? t('staffPortal.pendingDialogTitle')
                : t('staffPortal.suspendedDialogTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockReason === 'pending'
                ? t('staffPortal.pendingDialogBody')
                : t('staffPortal.suspendedDialogBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBlockReason(null)}>
              {t('staffPortal.understood')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
