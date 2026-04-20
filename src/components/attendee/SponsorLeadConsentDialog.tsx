import { useTranslation } from 'react-i18next';
import { User, Mail, Briefcase, Building2, Phone } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sponsorName: string;
  loading: boolean;
}

const FIELDS = [
  { icon: User, key: 'name' },
  { icon: Mail, key: 'email' },
  { icon: Briefcase, key: 'specialty' },
  { icon: Building2, key: 'institution' },
  { icon: Phone, key: 'phone' },
] as const;

export function SponsorLeadConsentDialog({ open, onClose, onConfirm, sponsorName, loading }: Props) {
  const { t } = useTranslation('commercial');

  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('lead.consent.title', { sponsor: sponsorName })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{t('lead.consent.intro')}</p>
              <ul className="space-y-2">
                {FIELDS.map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{t(`lead.consent.fields.${key}`)}</span>
                  </li>
                ))}
              </ul>
              <p>{t('lead.consent.purpose')}</p>
              <p className="text-xs text-muted-foreground/70 italic">
                {t('lead.consent.privacy')}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {t('lead.consent.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            {t('lead.consent.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
