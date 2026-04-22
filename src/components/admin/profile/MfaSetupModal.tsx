import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Copy, Check } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';

interface MfaSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: () => void;
}

interface EnrollState {
  factorId: string;
  qrCode: string; // SVG
  secret: string;
  uri: string;
}

export function MfaSetupModal({ open, onOpenChange, onEnrolled }: MfaSetupModalProps) {
  const { t } = useTranslation('admin');
  const { toast } = useToast();
  const { refreshMfaState } = useAuth();

  const [enrollment, setEnrollment] = useState<EnrollState | null>(null);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      // Cleanup on close: unenroll any pending factor (not yet verified)
      if (enrollment) {
        authService.mfa.unenroll(enrollment.factorId).catch(() => {});
      }
      setEnrollment(null);
      setCode('');
      setSecretCopied(false);
      return;
    }

    // Begin enrollment when modal opens
    setIsLoading(true);
    authService.mfa
      .enroll()
      .then((data) => {
        setEnrollment({
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri,
        });
      })
      .catch(() => {
        toast({ variant: 'destructive', title: t('mfa.setup.enrollError') });
        onOpenChange(false);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCopySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleVerify = async () => {
    if (!enrollment || code.length !== 6) return;
    setIsVerifying(true);
    try {
      await authService.mfa.challengeAndVerify(enrollment.factorId, code);
      await refreshMfaState();
      toast({ title: t('mfa.setup.success') });
      onEnrolled();
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: t('mfa.setup.invalidCode') });
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('mfa.setup.title')}</DialogTitle>
          <DialogDescription>{t('mfa.setup.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t('mfa.setup.step1')}</li>
            <li>{t('mfa.setup.step2')}</li>
            <li>{t('mfa.setup.step3')}</li>
          </ol>

          {isLoading || !enrollment ? (
            <div className="flex justify-center py-8">
              <Skeleton className="h-48 w-48" />
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <div
                  className="rounded-lg border bg-white p-2"
                  dangerouslySetInnerHTML={{ __html: enrollment.qrCode }}
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('mfa.setup.manualCode')}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
                    {enrollment.secret}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleCopySecret}
                    aria-label={t('mfa.setup.copy')}
                  >
                    {secretCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{t('mfa.setup.enterCode')}</p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={setCode} disabled={isVerifying}>
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
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isVerifying}>
            {t('mfa.setup.cancel')}
          </Button>
          <Button onClick={handleVerify} disabled={!enrollment || code.length !== 6 || isVerifying}>
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('mfa.setup.verifying')}
              </>
            ) : (
              t('mfa.setup.verify')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
