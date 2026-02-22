import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Globe, Download, Mail, MessageCircle, Video, Linkedin, Instagram, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSponsor } from '@/hooks/useSponsors';
import { useEventSlug, useEvent } from '@/hooks/useEvent';

const LEVEL_STYLES: Record<string, string> = {
  gold: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  silver: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  bronze: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  exhibitor: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function SponsorDetail() {
  const { t } = useTranslation('commercial');
  const { sponsorId } = useParams<{ sponsorId: string }>();
  const navigate = useNavigate();
  const eventSlug = useEventSlug();
  const { event } = useEvent();
  const { data: sponsor, isLoading } = useSponsor(sponsorId ?? '');

  if (isLoading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-20" />
        <div className="flex flex-col items-center space-y-3">
          <Skeleton className="h-[120px] w-[120px] rounded-full" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!sponsor) return null;

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate(`/${eventSlug}/commercial`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </button>

      {/* Logo + Name */}
      <div className="flex flex-col items-center text-center space-y-3">
        {sponsor.logo_url ? (
          <img src={sponsor.logo_url} alt={sponsor.name} className="h-[120px] w-[120px] object-contain" />
        ) : (
          <div className="h-[120px] w-[120px] rounded-full bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground">
            {getInitials(sponsor.name)}
          </div>
        )}
        <h1 className="text-2xl font-bold text-foreground">{sponsor.name}</h1>
        <div className="flex gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${LEVEL_STYLES[sponsor.level]}`}>
            {t(`level.${sponsor.level}`)}
          </span>
          <Badge variant="secondary" className="text-xs">
            {t(`category.${sponsor.category}`)}
          </Badge>
        </div>
      </div>

      {/* Description */}
      {sponsor.description && (
        <p className="text-sm text-foreground leading-relaxed">{sponsor.description}</p>
      )}

      {/* Stand */}
      {sponsor.stand_location && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{t('detail.stand')} {sponsor.stand_location}</span>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3 pt-2">
        {sponsor.website_url && (
          <Button className="w-full" onClick={() => window.open(sponsor.website_url!, '_blank')}>
            <Globe className="h-4 w-4" />
            {t('detail.website')}
          </Button>
        )}
        {sponsor.materials_url && (
          <Button variant="outline" className="w-full" onClick={() => window.open(sponsor.materials_url!, '_blank')}>
            <Download className="h-4 w-4" />
            {t('detail.materials')}
          </Button>
        )}
        {sponsor.video_url && (
          <Button variant="outline" className="w-full" onClick={() => window.open(sponsor.video_url!, '_blank')}>
            <Video className="h-4 w-4" />
            {t('detail.video')}
          </Button>
        )}
        {sponsor.contact_email && (
          <Button variant="outline" className="w-full" asChild>
            <a href={`mailto:${sponsor.contact_email}`}>
              <Mail className="h-4 w-4" />
              {t('detail.contact')}
            </a>
          </Button>
        )}
        {sponsor.whatsapp && (
          <Button variant="outline" className="w-full" onClick={() => {
            const message = sponsor.whatsapp_message || 
              `Hola, te contacto desde el ${event?.name ?? ''}. Me interesa conocer más sobre ${sponsor.name}.`;
            window.open(`https://wa.me/${sponsor.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
          }}>
            <MessageCircle className="h-4 w-4" />
            {t('detail.whatsapp')}
          </Button>
        )}
      </div>

      {/* Social Links */}
      {(sponsor.social_linkedin || sponsor.social_instagram || sponsor.social_twitter) && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2">{t('detail.social')}</p>
          <div className="flex gap-3">
            {sponsor.social_linkedin && (
              <Button variant="outline" size="icon" onClick={() => window.open(sponsor.social_linkedin!, '_blank')}>
                <Linkedin className="h-4 w-4" />
              </Button>
            )}
            {sponsor.social_instagram && (
              <Button variant="outline" size="icon" onClick={() => window.open(sponsor.social_instagram!, '_blank')}>
                <Instagram className="h-4 w-4" />
              </Button>
            )}
            {sponsor.social_twitter && (
              <Button variant="outline" size="icon" onClick={() => window.open(sponsor.social_twitter!, '_blank')}>
                <Twitter className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
