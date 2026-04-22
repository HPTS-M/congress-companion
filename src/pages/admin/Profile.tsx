import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { SecuritySettingsCard } from '@/components/admin/profile/SecuritySettingsCard';

export default function AdminProfile() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { eventSlug } = useEvent();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${eventSlug}/admin/dashboard`)}
          aria-label={t('profile.back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.accountInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('profile.email')}:</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('profile.userId')}:</span>
            <span className="font-mono text-xs">{user?.id}</span>
          </div>
        </CardContent>
      </Card>

      <SecuritySettingsCard />
    </div>
  );
}
