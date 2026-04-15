import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEventSlug, useEventSettings } from '@/hooks/useEvent';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Mail, Building2, Stethoscope, CreditCard } from 'lucide-react';

export default function MyProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { attendee, logout } = useAuth();
  const eventSlug = useEventSlug();
  const { qrEnabled } = useEventSettings();

  const { data: fullProfile } = useQuery({
    queryKey: ['my-profile', attendee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendees')
        .select('specialty, institution')
        .eq('id', attendee!.id)
        .single();
      return data;
    },
    enabled: !!attendee,
  });

  const handleLogout = async () => {
    await logout();
    navigate(`/${eventSlug}`);
  };

  if (!attendee) return null;

  // Email and credential_code are always shown (with fallback placeholder)
  const alwaysVisibleItems = [
    { icon: Mail, label: t('profile.email'), value: attendee.email || t('profile.notAssigned', 'No asignado') },
    { icon: CreditCard, label: t('profile.credentialCode'), value: attendee.credential_code || t('profile.notAssigned', 'No asignado') },
  ];

  // Optional items only shown when they have a value
  const optionalItems = [
    { icon: Stethoscope, label: t('profile.specialty'), value: fullProfile?.specialty },
    { icon: Building2, label: t('profile.institution'), value: fullProfile?.institution },
  ].filter(item => item.value);

  const infoItems = [...alwaysVisibleItems, ...optionalItems];

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
          {attendee.full_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <h2 className="text-xl font-semibold text-foreground">{attendee.full_name}</h2>
      </div>

      {/* QR Code */}
      {qrEnabled && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-6">
            <QRCodeSVG value={attendee.credential_code || attendee.id} size={160} />
            <p className="text-xs text-muted-foreground">{t('home.showToStaff')}</p>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {infoItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="truncate text-sm font-medium text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        {t('logout')}
      </Button>
    </div>
  );
}
