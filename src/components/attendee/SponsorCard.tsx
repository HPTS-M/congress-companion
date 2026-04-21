import { useTranslation } from 'react-i18next';
import { ChevronRight, MapPin, Building2, Crown, Award, Medal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SponsorLeadButton } from '@/components/attendee/SponsorLeadButton';
import type { Sponsor } from '@/services/sponsors.service';

// Border-left color per sponsor level (mirrors Agenda's per-type color strategy)
const LEVEL_BORDER: Record<string, string> = {
  gold: '#F59E0B',
  silver: '#94A3B8',
  bronze: '#B45309',
  exhibitor: '#1A56A0',
};

const LEVEL_ICON: Record<string, LucideIcon> = {
  gold: Crown,
  silver: Award,
  bronze: Medal,
  exhibitor: Building2,
};

const LEVEL_BADGE_CLASS: Record<string, string> = {
  gold: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50',
  silver: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  bronze: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-900/50',
  exhibitor: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50',
};

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

interface SponsorCardProps {
  sponsor: Sponsor;
  eventId?: string;
  onView: () => void;
}

export function SponsorCard({ sponsor, eventId, onView }: SponsorCardProps) {
  const { t } = useTranslation('commercial');
  const borderColor = LEVEL_BORDER[sponsor.level] ?? LEVEL_BORDER.exhibitor;
  const LevelIcon = LEVEL_ICON[sponsor.level] ?? Building2;
  const levelBadgeClass = LEVEL_BADGE_CLASS[sponsor.level] ?? LEVEL_BADGE_CLASS.exhibitor;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView();
        }
      }}
      className="group rounded-lg border-t border-r border-b border-border bg-card shadow-sm p-4 pl-5 cursor-pointer transition-all hover:shadow-md"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left — logo */}
        {sponsor.logo_url ? (
          <img
            src={sponsor.logo_url}
            alt={sponsor.name}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded object-contain bg-white shrink-0 border border-border"
          />
        ) : (
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded bg-muted flex items-center justify-center text-base font-bold text-muted-foreground shrink-0">
            {getInitials(sponsor.name)}
          </div>
        )}

        {/* Center — info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title + chevron */}
          <div className="flex items-start gap-2">
            <h3 className="text-base font-semibold text-card-foreground leading-tight flex-1 min-w-0">
              {sponsor.name}
            </h3>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
          </div>

          {/* Stand */}
          {sponsor.stand_location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>Stand {sponsor.stand_location}</span>
            </div>
          )}

          {/* Category */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>{t(`category.${sponsor.category}`)}</span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className={cn('text-[11px] font-medium gap-1', levelBadgeClass)}>
              <LevelIcon className="h-3 w-3" />
              {t(`level.${sponsor.level}`)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Bottom — lead capture CTA */}
      {eventId && (
        <div
          className="mt-3 flex justify-end"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <SponsorLeadButton
            sponsorId={sponsor.id}
            eventId={eventId}
            sponsorName={sponsor.name}
            compact
            className="text-xs h-8 px-3"
          />
        </div>
      )}
    </div>
  );
}
