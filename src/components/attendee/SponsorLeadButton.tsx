import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sponsorLeadsService } from '@/services/sponsor-leads.service';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  sponsorId: string;
  eventId: string;
  className?: string;
}

export function SponsorLeadButton({ sponsorId, eventId, className }: Props) {
  const { t } = useTranslation('commercial');
  const { attendee } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const attendeeId = attendee?.id;

  useEffect(() => {
    if (!attendeeId) return;
    sponsorLeadsService.getMyLeadForSponsor(sponsorId, attendeeId).then(lead => {
      if (lead) setSubmitted(true);
    }).catch(() => {});
  }, [sponsorId, attendeeId]);

  const handleClick = async () => {
    if (!attendeeId || submitted) return;
    setLoading(true);
    try {
      await sponsorLeadsService.create(sponsorId, attendeeId, eventId);
      setSubmitted(true);
      toast.success(t('lead.success'));
    } catch {
      toast.error(t('lead.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!attendeeId) return null;

  return (
    <Button
      variant={submitted ? 'secondary' : 'default'}
      size="sm"
      className={className}
      onClick={handleClick}
      disabled={loading || submitted}
    >
      <Heart className={`h-4 w-4 ${submitted ? 'fill-current' : ''}`} />
      {submitted ? t('lead.submitted') : t('lead.interested')}
    </Button>
  );
}
