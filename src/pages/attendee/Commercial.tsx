import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, ChevronRight, MapPin, X, Check, Crown, Award, Medal } from 'lucide-react';
import { SponsorLeadButton } from '@/components/attendee/SponsorLeadButton';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useEvent, useEventSlug } from '@/hooks/useEvent';
import { useSponsors } from '@/hooks/useSponsors';
import { cn } from '@/lib/utils';
import type { Sponsor } from '@/services/sponsors.service';

const LEVEL_ORDER = ['gold', 'silver', 'bronze', 'exhibitor'] as const;

const LEVEL_META: Record<string, { icon: typeof Crown; text: string; line: string; dot: string }> = {
  gold: {
    icon: Crown,
    text: 'text-amber-600 dark:text-amber-400',
    line: 'bg-amber-200 dark:bg-amber-900/50',
    dot: 'bg-amber-500',
  },
  silver: {
    icon: Award,
    text: 'text-slate-500 dark:text-slate-300',
    line: 'bg-slate-200 dark:bg-slate-700',
    dot: 'bg-slate-400',
  },
  bronze: {
    icon: Medal,
    text: 'text-orange-700 dark:text-orange-400',
    line: 'bg-orange-200 dark:bg-orange-900/50',
    dot: 'bg-orange-600',
  },
  exhibitor: {
    icon: Building2,
    text: 'text-slate-500 dark:text-slate-400',
    line: 'bg-slate-200 dark:bg-slate-700',
    dot: 'bg-slate-400',
  },
};

const CATEGORIES = ['pharmaceutical', 'technology', 'medical_equipment', 'services', 'education', 'other'] as const;

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Commercial() {
  const { t } = useTranslation('commercial');
  const { event } = useEvent();
  const eventSlug = useEventSlug();
  const navigate = useNavigate();
  const { data: sponsors, isLoading } = useSponsors(event?.id ?? '');

  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Filter by search only — used to compute category counts
  const searchFiltered = useMemo(() => {
    if (!sponsors) return [];
    const q = search.trim().toLowerCase();
    if (!q) return sponsors;
    return sponsors.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.stand_location?.toLowerCase().includes(q)
    );
  }, [sponsors, search]);

  // Final filter (search + category)
  const filtered = useMemo(() => {
    if (selectedCategories.length === 0) return searchFiltered;
    return searchFiltered.filter(s => selectedCategories.includes(s.category));
  }, [searchFiltered, selectedCategories]);

  // Per-category counts (based on search-filtered set, ignoring category selection)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of searchFiltered) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [searchFiltered]);

  const grouped = useMemo(() => {
    const map: Record<string, Sponsor[]> = {};
    for (const level of LEVEL_ORDER) {
      const items = filtered.filter(s => s.level === level);
      if (items.length > 0) map[level] = items;
    }
    return map;
  }, [filtered]);

  const showResultsCount = search.trim().length > 0 || selectedCategories.length > 0;

  if (isLoading) {
    return (
      <div className="px-4 pt-4 pb-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('clearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {showResultsCount && (
          <p className="text-xs text-muted-foreground mt-1.5 px-1">
            {t('searchResults', { count: filtered.length })}
          </p>
        )}
      </div>

      {/* Category chips with counters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <CategoryChip
          label={`${t('allCategories')} (${searchFiltered.length})`}
          active={selectedCategories.length === 0}
          onClick={() => setSelectedCategories([])}
        />
        {CATEGORIES.filter(cat => (categoryCounts[cat] ?? 0) > 0).map(cat => (
          <CategoryChip
            key={cat}
            label={`${t(`category.${cat}`)} (${categoryCounts[cat]})`}
            active={selectedCategories.includes(cat)}
            onClick={() => toggleCategory(cat)}
          />
        ))}
      </div>

      {/* Sponsors grouped by level */}
      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">{t('noSponsors')}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([level, items]) => (
          <section key={level} className="space-y-3">
            <LevelDivider level={level} label={t(`level.${level}`)} />
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
              {items.map(sponsor => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  eventId={event?.id}
                  onView={() => navigate(`/${eventSlug}/commercial/${sponsor.id}`)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
        active
          ? 'bg-[#1A56A0] text-white border-[#1A56A0] shadow-sm'
          : 'bg-card text-muted-foreground border-border hover:border-[#1A56A0]/40'
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}

function LevelDivider({ level, label }: { level: string; label: string }) {
  const meta = LEVEL_META[level] ?? LEVEL_META.exhibitor;
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3">
      <div className={cn('h-px flex-1', meta.line)} />
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide', meta.text)}>
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className={cn('h-px flex-1', meta.line)} />
    </div>
  );
}

function SponsorCard({
  sponsor,
  onView,
  eventId,
}: {
  sponsor: Sponsor;
  onView: () => void;
  eventId?: string;
}) {
  const { t } = useTranslation('commercial');
  const meta = LEVEL_META[sponsor.level] ?? LEVEL_META.exhibitor;

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
      className={cn(
        'group relative bg-card border border-border rounded-lg p-2.5 sm:p-3 shadow-sm cursor-pointer overflow-hidden',
        'transition-all hover:shadow-md hover:border-[#1A56A0]/40 active:scale-[0.99]',
        'flex flex-row items-start gap-2.5 sm:gap-3',
        'sm:flex-col sm:items-center sm:text-center'
      )}
    >
      {/* Logo */}
      {sponsor.logo_url ? (
        <img
          src={sponsor.logo_url}
          alt={sponsor.name}
          className="h-12 w-12 sm:h-20 sm:w-20 object-contain rounded shrink-0 bg-white"
        />
      ) : (
        <div className="h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-muted flex items-center justify-center text-sm sm:text-lg font-bold text-muted-foreground shrink-0">
          {getInitials(sponsor.name)}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:items-center sm:w-full">
        <div className="flex items-start gap-2 w-full sm:justify-center min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight truncate sm:line-clamp-2 sm:whitespace-normal flex-1 sm:flex-none sm:text-center min-w-0">
            {sponsor.name}
          </h3>
          {/* Chevron mobile only */}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 sm:hidden group-hover:text-[#1A56A0] transition-colors" />
        </div>

        {sponsor.stand_location && (
          <div className={cn('flex items-center gap-1 text-xs sm:justify-center', meta.text)}>
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">Stand {sponsor.stand_location}</span>
          </div>
        )}

        <span className="inline-flex w-fit text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground sm:mx-auto max-w-full truncate">
          {t(`category.${sponsor.category}`)}
        </span>

        {/* Action button — bottom right on mobile, full width on desktop */}
        {eventId && (
          <div
            className="mt-1 flex justify-end w-full sm:justify-center sm:mt-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <SponsorLeadButton
              sponsorId={sponsor.id}
              eventId={eventId}
              sponsorName={sponsor.name}
              compact
              className="text-[11px] h-7 px-2.5 max-w-full sm:text-xs sm:h-8 sm:w-full sm:px-3"
            />
          </div>
        )}
      </div>
    </div>
  );
}
