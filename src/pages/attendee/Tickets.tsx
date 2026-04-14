import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bus, UtensilsCrossed, Sparkles, Map, Ticket, Clock, CheckCircle2, ChevronDown, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTickets } from '@/hooks/useTickets';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { useEventSettings } from '@/hooks/useEvent';
import type { TicketServiceItem } from '@/services/tickets.service';

type FilterTab = 'all' | 'pending' | 'used';

const CATEGORY_CONFIG: Record<string, { icon: typeof Bus; bgClass: string; textClass: string }> = {
  transport: { icon: Bus, bgClass: 'bg-blue-100 dark:bg-blue-900', textClass: 'text-blue-600 dark:text-blue-300' },
  food: { icon: UtensilsCrossed, bgClass: 'bg-orange-100 dark:bg-orange-900', textClass: 'text-orange-600 dark:text-orange-300' },
  special: { icon: Sparkles, bgClass: 'bg-purple-100 dark:bg-purple-900', textClass: 'text-purple-600 dark:text-purple-300' },
  tour: { icon: Map, bgClass: 'bg-green-100 dark:bg-green-900', textClass: 'text-green-600 dark:text-green-300' },
};

function isPending(item: TicketServiceItem) {
  return item.status === 'scheduled' || item.status === 'pending';
}

function isUsed(item: TicketServiceItem) {
  return item.status === 'completed' || item.status === 'used';
}

export default function Tickets() {
  const { t } = useTranslation('tickets');
  const { attendee } = useAuth();
  const { data: items, isLoading } = useTickets(attendee?.id);
  const [filter, setFilter] = useState<FilterTab>('all');

  const pendingCount = items?.filter(isPending).length ?? 0;
  const usedCount = items?.filter(isUsed).length ?? 0;

  const filtered = items?.filter((item) => {
    if (filter === 'pending') return isPending(item);
    if (filter === 'used') return isUsed(item);
    return true;
  }) ?? [];

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('filter.all') },
    { key: 'pending', label: t('filter.pending') },
    { key: 'used', label: t('filter.used') },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-6 w-6 shrink-0" style={{ color: '#1A56A0' }} />
            <div>
              <p className="text-xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">{t('filter.pending')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: '#00B89F' }} />
            <div>
              <p className="text-xl font-bold text-foreground">{usedCount}</p>
              <p className="text-xs text-muted-foreground">{t('filter.used')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              filter === tab.key
                ? 'text-white'
                : 'bg-muted text-muted-foreground',
            )}
            style={filter === tab.key ? { backgroundColor: '#1A56A0' } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Service list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Ticket className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('noTickets')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <TicketItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketItem({ item }: { item: TicketServiceItem }) {
  const { t } = useTranslation('tickets');
  const { qrEnabled } = useEventSettings();
  const catalog = item.service_catalog;
  const ticket = item.service_tickets?.[0];
  const serviceType = catalog?.service_type ?? 'special';
  const config = CATEGORY_CONFIG[serviceType] ?? CATEGORY_CONFIG.special;
  const Icon = config.icon;
  const used = isUsed(item);

  return (
    <Collapsible>
      <Card className={cn(used && 'opacity-70')}>
        <CollapsibleTrigger className="w-full text-left">
          <CardContent className="flex items-center gap-3 p-4">
            {/* Category icon */}
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', config.bgClass)}>
              <Icon className={cn('h-5 w-5', config.textClass)} />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className={cn('text-[15px] font-semibold text-foreground', used && 'line-through')}>
                {catalog?.name}
              </p>
              <p className="truncate text-[13px] text-muted-foreground">
                {catalog?.description}
              </p>
              {catalog?.valid_from && catalog?.valid_until && (
                <p className="text-xs text-muted-foreground">
                  {t('validity', { from: catalog.valid_from.slice(0, 5), to: catalog.valid_until.slice(0, 5) })}
                </p>
              )}
            </div>

            {/* Status badge + chevron */}
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  used
                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                )}
              >
                {used ? t('filter.used') : t('filter.pending')}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t px-4 pb-4 pt-3">
            {catalog?.description && (
              <p className="text-sm text-muted-foreground">{catalog.description}</p>
            )}
            {catalog?.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{catalog.location}</span>
              </div>
            )}
            {catalog?.valid_from && catalog?.valid_until && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{t('validity', { from: catalog.valid_from.slice(0, 5), to: catalog.valid_until.slice(0, 5) })}</span>
              </div>
            )}
            {item.scheduled_date && (
              <p className="text-sm text-muted-foreground">
                {t('scheduledDate')}: {item.scheduled_date}
              </p>
            )}
            {ticket && qrEnabled && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <QRCodeSVG value={ticket.qr_data} size={160} />
                <p className="text-xs font-mono text-muted-foreground">{ticket.ticket_code}</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
