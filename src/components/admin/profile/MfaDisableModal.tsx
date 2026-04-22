import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';

interface MfaDisableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factorId: string;
  onDisabled: () => void;
}

export function MfaDisableModal({ open, onOpenChange, factorId, onDisabled }: MfaDisableModalProps) {
  const { t } = useTranslation('admin');
  const { toast } = useToast();
  const { refreshMfaState } = useAuth();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (code.length !== 6) return;
    setIsSubmitting(true);
    try {
      // Verify the user can still produce a valid TOTP code before unenrolling
      await authService.mfa.challengeAndVerify(factorId, code);
      await authService.mfa.unenroll(factorId);
      await refreshMfaState();
      toast({ title: t('mfa.disable.success') });
      onDisabled();
      onOpenChange(false);
      setCode('');
    } catch {
      toast({ variant: 'destructive', title: t('mfa.disable.invalidCode') });
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('mfa.disable.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('mfa.disable.warning')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-sm font-medium">{t('mfa.disable.enterCurrentCode')}</p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode} disabled={isSubmitting}>
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

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>{t('mfa.disable.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={code.length !== 6 || isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('mfa.disable.disabling')}
              </>
            ) : (
              t('mfa.disable.confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
