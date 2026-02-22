import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DaySelectorProps {
  dates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

export function DaySelector({ dates, selectedDate, onSelect }: DaySelectorProps) {
  const { t, i18n } = useTranslation('agenda');
  const locale = i18n.language.startsWith('es') ? es : enUS;

  return (
    <div className="sticky top-14 z-40 bg-background border-b border-border md:top-16">
      <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
        {dates.map((date, idx) => {
          const parsed = parseISO(date);
          const isActive = date === selectedDate;
          return (
            <button
              key={date}
              onClick={() => onSelect(date)}
              className={cn(
                'flex flex-col items-center rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors min-w-[72px]',
                isActive
                  ? 'bg-[hsl(213,72%,37%)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <span className="text-xs">{t('daySelector', { number: idx + 1 })}</span>
              <span className="text-[11px] capitalize">
                {format(parsed, 'd MMM', { locale })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
