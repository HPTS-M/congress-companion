import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataQuality } from '@/hooks/useAdminAttendees';
import { cn } from '@/lib/utils';

interface Props {
  onFilterByIds: (ids: string[], label: string) => void;
}

export function DataQualityPanel({ onFilterByIds }: Props) {
  const { t } = useTranslation('admin');
  const { data, isLoading } = useDataQuality();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (!data) return null;

  const alerts = [
    {
      type: 'error' as const,
      label: t('attendees.dataQuality.noEmail'),
      ids: data.noEmail,
      icon: AlertCircle,
    },
    {
      type: 'error' as const,
      label: t('attendees.dataQuality.duplicateCodes'),
      ids: data.duplicateCodes,
      icon: AlertCircle,
    },
    {
      type: 'warning' as const,
      label: t('attendees.dataQuality.duplicateEmails'),
      ids: data.duplicateEmails,
      icon: AlertTriangle,
    },
    {
      type: 'warning' as const,
      label: t('attendees.dataQuality.noSpecialty'),
      ids: data.noSpecialty,
      icon: AlertTriangle,
    },
  ].filter((a) => a.ids.length > 0);

  const hasIssues = alerts.length > 0;

  return (
    <Card>
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between p-4 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            {hasIssues ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-accent" />
            )}
            {t('attendees.dataQuality.title')}
            {!hasIssues && (
              <span className="text-xs font-normal text-muted-foreground">
                {t('attendees.dataQuality.noIssues')}
              </span>
            )}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="border-t px-4 pb-4 pt-2 space-y-2">
            {!hasIssues ? (
              <p className="text-sm text-muted-foreground py-2">{t('attendees.dataQuality.noIssues')}</p>
            ) : (
              alerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <div
                    key={alert.label}
                    className={cn(
                      'flex items-center justify-between rounded-lg p-3 text-sm',
                      alert.type === 'error' && 'bg-destructive/10',
                      alert.type === 'warning' && 'bg-amber-500/10',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          alert.type === 'error' && 'text-destructive',
                          alert.type === 'warning' && 'text-amber-500',
                        )}
                      />
                      <span className="text-foreground">{alert.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({t('attendees.dataQuality.count', { count: alert.ids.length })})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => onFilterByIds(alert.ids, alert.label)}
                    >
                      {t('attendees.dataQuality.viewAffected')}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
