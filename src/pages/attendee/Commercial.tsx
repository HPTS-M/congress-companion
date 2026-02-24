import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Building2 } from 'lucide-react';
import { SponsorLeadButton } from '@/components/attendee/SponsorLeadButton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useEvent, useEventSlug } from '@/hooks/useEvent';
import { useSponsors } from '@/hooks/useSponsors';
import type { Sponsor } from '@/services/sponsors.service';

const LEVEL_ORDER = ['gold', 'silver', 'bronze', 'exhibitor'] as const;

const LEVEL_STYLES: Record<string, string> = {
  gold: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  silver: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  bronze: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  exhibitor: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

const CATEGORIES = ['pharmaceutical', 'technology', 'medical_equipment', 'services', 'education'] as const;

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

  const filtered = useMemo(() => {
    if (!sponsors) return [];
    return sponsors.filter(s => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q)) ||
        (s.stand_location?.toLowerCase().includes(q));
      const matchesCat = selectedCategories.length === 0 || selectedCategories.includes(s.category);
      return matchesSearch && matchesCat;
    });
  }, [sponsors, search, selectedCategories]);

  const grouped = useMemo(() => {
    const map: Record<string, Sponsor[]> = {};
    for (const level of LEVEL_ORDER) {
      const items = filtered.filter(s => s.level === level);
      if (items.length > 0) map[level] = items;
    }
    return map;
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedCategories([])}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            selectedCategories.length === 0
              ? 'bg-[#1A56A0] text-white border-[#1A56A0]'
              : 'bg-white dark:bg-slate-800 text-muted-foreground border-border'
          }`}
        >
          {t('allCategories')}
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedCategories.includes(cat)
                ? 'bg-[#1A56A0] text-white border-[#1A56A0]'
                : 'bg-white dark:bg-slate-800 text-muted-foreground border-border'
            }`}
          >
            {t(`category.${cat}`)}
          </button>
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
          <div key={level} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${LEVEL_STYLES[level]}`}>
                {t(`level.${level}`)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {items.map(sponsor => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  eventId={event?.id}
                  onView={() => navigate(`/${eventSlug}/commercial/${sponsor.id}`)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SponsorCard({ sponsor, onView, eventId }: { sponsor: Sponsor; onView: () => void; eventId?: string }) {
  const { t } = useTranslation('commercial');

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center text-center space-y-2 shadow-sm">
      {sponsor.logo_url ? (
        <img
          src={sponsor.logo_url}
          alt={sponsor.name}
          className="h-20 w-20 object-contain rounded"
        />
      ) : (
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
          {getInitials(sponsor.name)}
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground leading-tight">{sponsor.name}</h3>
      <Badge variant="secondary" className="text-[11px]">
        {t(`category.${sponsor.category}`)}
      </Badge>
      {sponsor.stand_location && (
        <p className="text-xs text-muted-foreground">Stand {sponsor.stand_location}</p>
      )}
      {eventId && (
        <SponsorLeadButton sponsorId={sponsor.id} eventId={eventId} className="w-full text-xs" />
      )}
      <Button variant="outline" size="sm" className="w-full text-xs mt-auto" onClick={onView}>
        {t('viewMore')} →
      </Button>
    </div>
  );
}
