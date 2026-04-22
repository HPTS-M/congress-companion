import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { MfaSetupModal } from './MfaSetupModal';
import { MfaDisableModal } from './MfaDisableModal';

export function SecuritySettingsCard() {
  const { t } = useTranslation('admin');
  const { mfaEnrolled, mfaFactorId, refreshMfaState } = useAuth();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      setSetupOpen(true);
    } else if (mfaFactorId) {
      setDisableOpen(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {mfaEnrolled ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle>{t('mfa.card.title')}</CardTitle>
            {mfaEnrolled && (
              <Badge variant="outline" className="ml-auto border-primary/40 text-primary">
                {t('mfa.card.activeBadge')}
              </Badge>
            )}
          </div>
          <CardDescription>{t('mfa.card.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="font-medium">{t('mfa.card.toggleLabel')}</p>
              <p className="text-sm text-muted-foreground">
                {mfaEnrolled ? t('mfa.card.enabledHint') : t('mfa.card.disabledHint')}
              </p>
            </div>
            <Switch checked={mfaEnrolled} onCheckedChange={handleToggle} />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {t('mfa.card.compatibleApps')}
          </p>
        </CardContent>
      </Card>

      <MfaSetupModal
        open={setupOpen}
        onOpenChange={setSetupOpen}
        onEnrolled={() => refreshMfaState()}
      />

      {mfaFactorId && (
        <MfaDisableModal
          open={disableOpen}
          onOpenChange={setDisableOpen}
          factorId={mfaFactorId}
          onDisabled={() => refreshMfaState()}
        />
      )}
    </>
  );
}
