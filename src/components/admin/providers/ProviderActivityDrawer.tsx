import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LogIn, Mail, MailCheck, Ticket, Activity, Download } from 'lucide-react';
import { adminProvidersService, type ProviderRow } from '@/services/admin-providers.service';

interface Props {
  open: boolean;
  onClose: () => void;
  provider: ProviderRow | null;
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  login: LogIn,
  invitation_sent: Mail,
  invitation_resent: MailCheck,
  ticket_validated: Ticket,
};

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ProviderActivityDrawer({ open, onClose, provider }: Props) {
  const { t } = useTranslation('admin');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['provider-activity', provider?.id, from, to, type],
    queryFn: () =>
      adminProvidersService.getActivityLog(provider!.id, {
        from: from ? new Date(from) : null,
        to: to ? new Date(`${to}T23:59:59`) : null,
        type: type !== 'all' ? type : null,
      }),
    enabled: !!provider?.id && open,
  });

  const types = useMemo(
    () => ['login', 'invitation_sent', 'invitation_resent', 'ticket_validated'],
    [],
  );

  const handleExport = () => {
    if (!data || !provider) return;
    const header = ['date', 'activity_type', 'metadata'];
    const rows = data.map((r) => [
      format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
      r.activity_type,
      JSON.stringify(r.metadata),
    ]);
    downloadCsv(`provider-${provider.company_name}-activity.csv`, [header, ...rows]);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('providers.activityHistory')}</SheetTitle>
          <SheetDescription>{provider?.company_name}</SheetDescription>
        </SheetHeader>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <Label className="text-xs">{t('providers.filterFrom')}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t('providers.filterTo')}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">{t('providers.filterByType')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('providers.filterAll')}</SelectItem>
                {types.map((tp) => (
                  <SelectItem key={tp} value={tp}>
                    {t(`providers.activity_${tp}`, { defaultValue: tp })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data || data.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            {t('providers.exportCsv')}
          </Button>
        </div>

        {/* Timeline */}
        <div className="mt-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : !data?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('providers.noActivity')}
            </div>
          ) : (
            data.map((entry) => {
              const Icon = ACTIVITY_ICONS[entry.activity_type] ?? Activity;
              return (
                <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-border p-3 bg-card">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {t(`providers.activity_${entry.activity_type}`, { defaultValue: entry.activity_type })}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm', { locale: esLocale })}
                      </span>
                    </div>
                    {Object.keys(entry.metadata).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 break-words">
                        {Object.entries(entry.metadata)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
