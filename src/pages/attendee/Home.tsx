import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Calendar, MapPin, Users, ExternalLink, Copy, Check } from 'lucide-react';
import { useEvent, useEventSettings } from '@/hooks/useEvent';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

export default function Home() {
  const { t, i18n } = useTranslation();
  const { event } = useEvent();
  const settings = useEventSettings();
  const { bannerUrl } = settings;
  const [copied, setCopied] = useState(false);

  const fullAddress = event
    ? [event.venue_name, event.venue_address].filter(Boolean).join(', ')
    : '';

  const handleOpenMaps = () => {
    if (!fullAddress) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyAddress = async () => {
    if (!fullAddress) return;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      toast.success(t('home.addressCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('error'));
    }
  };

  const dateLocale = i18n.language === 'es' ? es : enUS;
  const startDate = event?.start_date ? format(new Date(event.start_date), 'dd MMM yyyy', { locale: dateLocale }) : '';
  const endDate = event?.end_date ? format(new Date(event.end_date), 'dd MMM yyyy', { locale: dateLocale }) : '';

  const bannerSrc = bannerUrl || '/logo-congreso.png';

  return (
    <div className="flex flex-col pt-0">
      {/* Logo Card */}
      <div className="mx-4 mt-6 flex flex-col items-center rounded-lg bg-card px-6 py-8 shadow-md">
        <img
          src={bannerSrc}
          alt="Logo Congreso"
          className="h-48 w-auto object-contain"
        />
      </div>

      {/* Event Info */}
      <div className="mx-4 mt-6 mb-6">
        <h2 className="mb-3 text-base font-semibold text-foreground">{t('home.eventInfo')}</h2>

        <div className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t('home.dateRange', { start: startDate, end: endDate })}</span>
          </div>

          {event?.venue_name && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3 text-sm text-foreground">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <span>{event.venue_name}{event.venue_address ? `, ${event.venue_address}` : ''}</span>
              </div>
              {event.venue_address && (
                <div className="flex flex-wrap gap-2 pl-7">
                  <Button size="sm" variant="outline" onClick={handleOpenMaps}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('home.openInMaps')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCopyAddress}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {t('home.copyAddress')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-sm text-foreground">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t('home.attendeeCount', { count: event?.max_attendees ?? 0 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
