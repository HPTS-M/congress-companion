import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X, Check, ChevronsUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface AttendeesFiltersValue {
  specialties: string[];
  institutions: string[];
  hasServices: 'yes' | 'no' | null;
}

interface Props {
  value: AttendeesFiltersValue;
  onChange: (next: AttendeesFiltersValue) => void;
  options: { specialties: string[]; institutions: string[] };
  isLoading?: boolean;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
  isLoading,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
  isLoading?: boolean;
}) {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const triggerLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? selected[0]
        : `${label} (${selected.length})`;

  if (isLoading) {
    return <Skeleton className="h-9 min-w-[140px] rounded-md" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 min-w-[140px] justify-between gap-2 truncate',
            selected.length > 0 && 'border-primary/40 bg-primary/5 text-primary',
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('attendees.filters.searchPlaceholder', { defaultValue: 'Search…' })} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <CommandItem
                    key={opt}
                    onSelect={() => {
                      onChange(
                        isSelected
                          ? selected.filter((s) => s !== opt)
                          : [...selected, opt],
                      );
                    }}
                  >
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                        isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{opt}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function HasServicesRadio({
  value,
  onChange,
}: {
  value: 'yes' | 'no' | null;
  onChange: (v: 'yes' | 'no' | null) => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <RadioGroup
      value={value ?? 'any'}
      onValueChange={(v) => onChange(v === 'any' ? null : (v as 'yes' | 'no'))}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem value="any" id="hs-any" />
        <Label htmlFor="hs-any" className="cursor-pointer text-sm font-normal">
          {t('attendees.filters.any', { defaultValue: 'Any' })}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="yes" id="hs-yes" />
        <Label htmlFor="hs-yes" className="cursor-pointer text-sm font-normal">
          {t('attendees.filters.withServices', { defaultValue: 'With services' })}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="no" id="hs-no" />
        <Label htmlFor="hs-no" className="cursor-pointer text-sm font-normal">
          {t('attendees.filters.withoutServices', { defaultValue: 'Without services' })}
        </Label>
      </div>
    </RadioGroup>
  );
}

export function AttendeesFilters({ value, onChange, options }: Props) {
  const { t } = useTranslation('admin');
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount = useMemo(
    () =>
      value.specialties.length +
      value.institutions.length +
      (value.hasServices ? 1 : 0),
    [value],
  );

  const clearAll = () => onChange({ specialties: [], institutions: [], hasServices: null });

  // Desktop inline + mobile sheet share controls
  const Controls = (
    <>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {t('attendees.filters.specialty', { defaultValue: 'Specialty' })}
        </Label>
        <MultiSelect
          label={t('attendees.filters.specialty', { defaultValue: 'Specialty' })}
          options={options.specialties}
          selected={value.specialties}
          onChange={(specialties) => onChange({ ...value, specialties })}
          emptyLabel={t('attendees.filters.noSpecialties', { defaultValue: 'No specialties' })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {t('attendees.filters.institution', { defaultValue: 'Institution' })}
        </Label>
        <MultiSelect
          label={t('attendees.filters.institution', { defaultValue: 'Institution' })}
          options={options.institutions}
          selected={value.institutions}
          onChange={(institutions) => onChange({ ...value, institutions })}
          emptyLabel={t('attendees.filters.noInstitutions', { defaultValue: 'No institutions' })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {t('attendees.filters.servicesLabel', { defaultValue: 'Services' })}
        </Label>
        <HasServicesRadio
          value={value.hasServices}
          onChange={(hasServices) => onChange({ ...value, hasServices })}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-2">
      {/* Desktop: inline filters */}
      <div className="hidden flex-wrap items-end gap-3 md:flex">
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('attendees.filters.specialty', { defaultValue: 'Specialty' })}
          </Label>
          <MultiSelect
            label={t('attendees.filters.specialty', { defaultValue: 'Specialty' })}
            options={options.specialties}
            selected={value.specialties}
            onChange={(specialties) => onChange({ ...value, specialties })}
            emptyLabel={t('attendees.filters.noSpecialties', { defaultValue: 'No specialties' })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('attendees.filters.institution', { defaultValue: 'Institution' })}
          </Label>
          <MultiSelect
            label={t('attendees.filters.institution', { defaultValue: 'Institution' })}
            options={options.institutions}
            selected={value.institutions}
            onChange={(institutions) => onChange({ ...value, institutions })}
            emptyLabel={t('attendees.filters.noInstitutions', { defaultValue: 'No institutions' })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('attendees.filters.servicesLabel', { defaultValue: 'Services' })}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-9 min-w-[140px] justify-between gap-2',
                  value.hasServices && 'border-primary/40 bg-primary/5 text-primary',
                )}
              >
                <span className="truncate">
                  {value.hasServices === 'yes'
                    ? t('attendees.filters.withServices', { defaultValue: 'With services' })
                    : value.hasServices === 'no'
                      ? t('attendees.filters.withoutServices', { defaultValue: 'Without services' })
                      : t('attendees.filters.servicesLabel', { defaultValue: 'Services' })}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-3" align="start">
              <HasServicesRadio
                value={value.hasServices}
                onChange={(hasServices) => onChange({ ...value, hasServices })}
              />
            </PopoverContent>
          </Popover>
        </div>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-9 self-end text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {t('attendees.filters.clearAll', { defaultValue: 'Clear all' })}
          </Button>
        )}
      </div>

      {/* Mobile: single button → Sheet */}
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 w-full justify-center gap-2">
              <Filter className="h-4 w-4" />
              {t('attendees.filters.title', { defaultValue: 'Filters' })}
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>{t('attendees.filters.title', { defaultValue: 'Filters' })}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">{Controls}</div>
            <SheetFooter className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={clearAll}>
                {t('attendees.filters.clearAll', { defaultValue: 'Clear all' })}
              </Button>
              <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                {t('attendees.filters.apply', { defaultValue: 'Apply' })}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active filter chips (both desktop and mobile) */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
          {value.specialties.map((s) => (
            <Badge key={`s-${s}`} variant="secondary" className="gap-1 bg-primary/10 text-primary hover:bg-primary/15">
              {s}
              <button
                onClick={() =>
                  onChange({ ...value, specialties: value.specialties.filter((x) => x !== s) })
                }
                aria-label={`${t('attendees.filters.remove', { defaultValue: 'Remove' })} ${s}`}
                className="ml-0.5 rounded hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {value.institutions.map((i) => (
            <Badge key={`i-${i}`} variant="secondary" className="gap-1 bg-primary/10 text-primary hover:bg-primary/15">
              {i}
              <button
                onClick={() =>
                  onChange({ ...value, institutions: value.institutions.filter((x) => x !== i) })
                }
                aria-label={`${t('attendees.filters.remove', { defaultValue: 'Remove' })} ${i}`}
                className="ml-0.5 rounded hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {value.hasServices && (
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary hover:bg-primary/15">
              {value.hasServices === 'yes'
                ? t('attendees.filters.withServices', { defaultValue: 'With services' })
                : t('attendees.filters.withoutServices', { defaultValue: 'Without services' })}
              <button
                onClick={() => onChange({ ...value, hasServices: null })}
                aria-label={t('attendees.filters.remove', { defaultValue: 'Remove' })}
                className="ml-0.5 rounded hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
