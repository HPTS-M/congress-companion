import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Mail, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useAttendeeProfile, useMyContacts, useSendContactRequest } from '@/hooks/useContacts';

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AttendeeProfile() {
  const { t } = useTranslation('contacts');
  const { attendeeId, eventSlug } = useParams();
  const navigate = useNavigate();
  const { attendee: me } = useAuth();
  const { event } = useEvent();

  const { data: profile, isLoading } = useAttendeeProfile(attendeeId);
  const { data: contacts } = useMyContacts(me?.id);
  const sendRequest = useSendContactRequest();

  const myId = me?.id;

  const contactInfo = contacts?.find(c =>
    (c.user_id === myId && c.contact_id === attendeeId) ||
    (c.contact_id === myId && c.user_id === attendeeId)
  );

  const isAccepted = contactInfo?.status === 'accepted';
  const isSent = contactInfo?.status === 'pending' && contactInfo.user_id === myId;

  const handleConnect = () => {
    if (!event?.id || !myId || !attendeeId) return;
    sendRequest.mutate({ eventId: event.id, userId: myId, contactId: attendeeId });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-20 w-20 rounded-full mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t('profileNotFound')}
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="px-4 pt-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Button>
      </div>

      <div className="flex flex-col items-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1A56A0] text-white text-2xl font-bold mb-4">
          {getInitials(profile.full_name)}
        </div>

        <h1 className="text-2xl font-bold text-foreground text-center">{profile.full_name}</h1>
        {profile.specialty && (
          <p className="text-sm text-muted-foreground mt-1">{profile.specialty}</p>
        )}
        {profile.institution && (
          <p className="text-sm text-muted-foreground">{profile.institution}</p>
        )}

        <div className="flex items-center gap-1 mt-3 text-xs text-[#00B89F]">
          <BadgeCheck className="h-4 w-4" />
          <span>{t('confirmedAttendee')}</span>
        </div>

        <div className="mt-6 w-full max-w-xs">
          {isAccepted ? (
            <Button className="w-full bg-[#00B89F] hover:bg-[#00a08a] text-white" disabled>
              <Check className="h-4 w-4 mr-2" />
              {t('connected')}
            </Button>
          ) : isSent ? (
            <Button className="w-full" variant="secondary" disabled>
              {t('sent')}
            </Button>
          ) : myId !== attendeeId ? (
            <Button className="w-full" onClick={handleConnect} disabled={sendRequest.isPending}>
              {t('connect')}
            </Button>
          ) : null}
        </div>

        {isAccepted && profile.email && (
          <div className="mt-6 w-full max-w-xs">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">{t('contactInfo')}</p>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{profile.email}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
