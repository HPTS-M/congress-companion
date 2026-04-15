import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEventSlug, useEventSettings } from '@/hooks/useEvent';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, Mail, Building2, Stethoscope, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function MyProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { attendee, logout } = useAuth();
  const eventSlug = useEventSlug();
  const { qrEnabled } = useEventSettings();
  const queryClient = useQueryClient();

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

  const [specialty, setSpecialty] = useState('');
  const [institution, setInstitution] = useState('');

  useEffect(() => {
    if (fullProfile) {
      setSpecialty(fullProfile.specialty ?? '');
      setInstitution(fullProfile.institution ?? '');
    }
  }, [fullProfile]);

  const hasChanges =
    specialty !== (fullProfile?.specialty ?? '') ||
    institution !== (fullProfile?.institution ?? '');

  const updateProfile = useMutation({
    mutationFn: async (values: { specialty: string; institution: string }) => {
      const { error } = await supabase
        .from('attendees')
        .update({
          specialty: values.specialty || null,
          institution: values.institution || null,
        })
        .eq('id', attendee!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', attendee?.id] });
      toast.success(t('profile.saved'));
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate(`/${eventSlug}`);
  };

  if (!attendee) return null;

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
          {/* Email — read only */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{t('profile.email')}</p>
              <p className="truncate text-sm font-medium text-foreground">
                {attendee.email || t('profile.notAssigned')}
              </p>
            </div>
          </div>

          {/* Credential code — read only */}
          <div className="flex items-center gap-3 px-4 py-3">
            <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{t('profile.credentialCode')}</p>
              <p className="truncate text-sm font-medium text-foreground">
                {attendee.credential_code || t('profile.notAssigned')}
              </p>
            </div>
          </div>

          {/* Specialty — editable */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{t('profile.specialty')}</p>
              <Input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder={t('profile.specialtyPlaceholder')}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>

          {/* Institution — editable */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{t('profile.institution')}</p>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder={t('profile.institutionPlaceholder')}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button — only when changed */}
      {hasChanges && (
        <Button
          className="w-full"
          onClick={() => updateProfile.mutate({ specialty, institution })}
          disabled={updateProfile.isPending}
        >
          {t('profile.save')}
        </Button>
      )}

      <Button variant="destructive" className="w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        {t('logout')}
      </Button>
    </div>
  );
}
