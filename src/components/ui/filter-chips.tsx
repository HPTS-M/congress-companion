import { useEffect, useRef } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * FilterChips — horizontal scrollable filter chips with snap, fade indicator,
 * and auto-scroll to active. Modeled after the Agenda day-selector UX.
 *
 * Scaling rule (keep in mind when adding filters):
 *   2–8 chips  → use this component (current sweet spot)
 *   9–15 chips → wrap in a "More filters" bottom sheet
 *   16+ chips  → switch to dropdown / sheet with internal search
 */
export interface FilterChipOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface FilterChipsProps {
  options: FilterChipOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Label for the "All" pseudo-chip. If omitted, no "All" chip is rendered. */
  allLabel?: string;
  allCount?: number;
  multiSelect?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function FilterChips({
  options,
  selected,
  onChange,
  allLabel,
  allCount,
  multiSelect = true,
  className,
  ariaLabel = 'Filters',
}: FilterChipsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active chip into view when selection changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [selected]);

  const toggle = (value: string) => {
    if (!multiSelect) {
      onChange([value]);
      return;
    }
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const allActive = selected.length === 0;

  return (
    <div className={cn('relative', className)}>
      <div
        ref={scrollerRef}
        role="group"
        aria-label={ariaLabel}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 -mb-2 pr-6 scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {allLabel && (
          <Chip
            ref={allActive ? activeRef : undefined}
            label={allLabel}
            count={allCount}
            active={allActive}
            onClick={() => onChange([])}
          />
        )}
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <Chip
              key={opt.value}
              ref={active ? activeRef : undefined}
              label={opt.label}
              count={opt.count}
              icon={opt.icon}
              active={active}
              onClick={() => toggle(opt.value)}
            />
          );
        })}
      </div>
      {/* Fade indicator on the right edge — adapts to bg via from-background */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 h-full w-6 bg-gradient-to-l from-background to-transparent"
      />
    </div>
  );
}

interface ChipProps {
  label: string;
  count?: number;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
}

const Chip = (() => {
  const Inner = (
    { label, count, icon: Icon, active, onClick }: ChipProps,
    ref: React.Ref<HTMLButtonElement>,
  ) => (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'shrink-0 snap-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
        'text-xs font-medium border transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'bg-card text-muted-foreground border-border hover:border-primary/40',
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {Icon && !active && <Icon className="h-3.5 w-3.5" />}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span className={cn('tabular-nums', active ? 'opacity-90' : 'opacity-70')}>
          ({count})
        </span>
      )}
    </button>
  );
  Inner.displayName = 'FilterChip';
  return Object.assign(
    // forwardRef
    (require('react') as typeof import('react')).forwardRef<HTMLButtonElement, ChipProps>(Inner),
  );
})();
