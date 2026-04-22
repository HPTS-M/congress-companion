import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useEventSlug } from '@/hooks/useEvent';
import { authService } from '@/services/auth.service';

export default function MfaVerify() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventSlug = useEventSlug();
  const { isAuthenticated, isAdmin, mfaEnrolled, mfaLevel, mfaFactorId, refreshMfaState, logout } = useAuth();

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Guards: if user not in correct state, redirect away
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate(`/${eventSlug}/admin/login`, { replace: true });
      return;
    }
    if (!mfaEnrolled) {
      navigate(`/${eventSlug}/admin/dashboard`, { replace: true });
      return;
    }
    if (mfaLevel === 'aal2') {
      navigate(`/${eventSlug}/admin/dashboard`, { replace: true });
    }
  }, [isAuthenticated, isAdmin, mfaEnrolled, mfaLevel, eventSlug, navigate]);

  const handleVerify = async () => {
    if (!mfaFactorId || code.length !== 6) return;
    setIsVerifying(true);
    try {
      await authService.mfa.challengeAndVerify(mfaFactorId, code);
      await refreshMfaState();
      toast({ title: t('mfa.verify.success') });
      navigate(`/${eventSlug}/admin/dashboard`, { replace: true });
    } catch {
      toast({ variant: 'destructive', title: t('mfa.verify.invalidCode') });
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate(`/${eventSlug}/admin/login`, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">{t('mfa.verify.title')}</CardTitle>
            <CardDescription>{t('mfa.verify.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={isVerifying}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={isVerifying || code.length !== 6}
              onClick={handleVerify}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('mfa.verify.verifying')}
                </>
              ) : (
                t('mfa.verify.submit')
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {t('mfa.verify.lostAccess')}
            </p>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('layout.logout')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
