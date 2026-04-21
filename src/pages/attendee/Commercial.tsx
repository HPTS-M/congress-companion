import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, X, Crown, Award, Medal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterChips, type FilterChipOption } from '@/components/ui/filter-chips';
import { SponsorCard } from '@/components/attendee/SponsorCard';
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

export default function Commercial() {
  const { t } = useTranslation('commercial');
  const { event } = useEvent();
  const eventSlug = useEventSlug();
  const navigate = useNavigate();
  const { data: sponsors, isLoading } = useSponsors(event?.id ?? '');

  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);


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
      <FilterChips
        ariaLabel={t('allCategories')}
        allLabel={t('allCategories')}
        allCount={searchFiltered.length}
        selected={selectedCategories}
        onChange={setSelectedCategories}
        options={CATEGORIES.filter(cat => (categoryCounts[cat] ?? 0) > 0).map<FilterChipOption>(cat => ({
          value: cat,
          label: t(`category.${cat}`),
          count: categoryCounts[cat],
        }))}
      />

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
            <div className="flex flex-col gap-3">
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

