import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Globe, Mail, MessageCircle, Linkedin, Instagram, MapPin, Play, FileText, Eye, MousePointerClick, Download } from 'lucide-react';
import { adminSponsorsService, type SponsorRow } from '@/services/admin-sponsors.service';

interface Props {
  open: boolean;
  onClose: () => void;
  sponsor: SponsorRow | null;
}

const LEVEL_COLORS: Record<string, string> = {
  gold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  silver: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  bronze: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  exhibitor: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

const LEVEL_LABELS: Record<string, string> = {
  gold: 'Oro', silver: 'Plata', bronze: 'Bronce', exhibitor: 'Expositor',
};

export function SponsorDetailDrawer({ open, onClose, sponsor }: Props) {
  const { t } = useTranslation('admin');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (sponsor?.logo_url) {
      adminSponsorsService.getSignedUrl(sponsor.logo_url).then(setLogoUrl).catch(() => setLogoUrl(null));
    } else {
      setLogoUrl(null);
    }
  }, [sponsor?.logo_url]);

  if (!sponsor) return null;

  const initials = sponsor.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('sponsors.detailTitle')}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt={sponsor.name} className="h-16 w-16 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {initials}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-foreground">{sponsor.name}</h3>
              <div className="flex gap-2 mt-1">
                <Badge className={LEVEL_COLORS[sponsor.level]}>{LEVEL_LABELS[sponsor.level] ?? sponsor.level}</Badge>
                <Badge variant="secondary">{t(`sponsors.cat_${sponsor.category}`)}</Badge>
              </div>
            </div>
          </div>

          {sponsor.description && (
            <p className="text-sm text-muted-foreground">{sponsor.description}</p>
          )}

          <Separator />

          {/* Contact info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{t('sponsors.detailContact')}</h4>
            {sponsor.stand_location && (
              <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /> {sponsor.stand_location}</div>
            )}
            {sponsor.website_url && (
              <div className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-muted-foreground" /> <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{sponsor.website_url}</a></div>
            )}
            {sponsor.contact_email && (
              <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {sponsor.contact_email}</div>
            )}
            {sponsor.whatsapp && (
              <div className="flex items-center gap-2 text-sm"><MessageCircle className="h-4 w-4 text-muted-foreground" /> {sponsor.whatsapp}</div>
            )}
            {sponsor.social_linkedin && (
              <div className="flex items-center gap-2 text-sm"><Linkedin className="h-4 w-4 text-muted-foreground" /> {sponsor.social_linkedin}</div>
            )}
            {sponsor.social_instagram && (
              <div className="flex items-center gap-2 text-sm"><Instagram className="h-4 w-4 text-muted-foreground" /> {sponsor.social_instagram}</div>
            )}
            {sponsor.video_url && (
              <div className="flex items-center gap-2 text-sm"><Play className="h-4 w-4 text-muted-foreground" /> <a href={sponsor.video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{sponsor.video_url}</a></div>
            )}
            {sponsor.materials_url && (
              <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-muted-foreground" /> {t('sponsors.hasMaterials')}</div>
            )}
          </div>

          <Separator />

          {/* Interaction stats */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{t('sponsors.detailStats')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <Eye className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-lg font-bold text-foreground">{sponsor.profile_views}</p>
                <p className="text-xs text-muted-foreground">{t('sponsors.statViews')}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <MousePointerClick className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-lg font-bold text-foreground">{sponsor.whatsapp_clicks}</p>
                <p className="text-xs text-muted-foreground">{t('sponsors.statWhatsapp')}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <Globe className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-lg font-bold text-foreground">{sponsor.website_clicks}</p>
                <p className="text-xs text-muted-foreground">{t('sponsors.statWebsite')}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <Download className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-lg font-bold text-foreground">{sponsor.materials_downloads}</p>
                <p className="text-xs text-muted-foreground">{t('sponsors.statMaterials')}</p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
