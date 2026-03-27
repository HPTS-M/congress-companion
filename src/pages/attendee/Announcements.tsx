import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { format, isToday, isYesterday } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Megaphone, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function formatAnnouncementTime(dateStr: string, locale: typeof es, yesterdayLabel: string): string {
  const d = new Date(dateStr);
  const time = format(d, 'HH:mm', { locale });
  if (isToday(d)) return time;
  if (isYesterday(d)) return `${yesterdayLabel} · ${time}`;
  return `${format(d, 'eee d MMM', { locale })} · ${time}`;
}

export default function Announcements() {
  const { t, i18n } = useTranslation('announcements');
  const { event } = useEvent();
  const eventId = event?.id ?? '';
  const { data: announcements = [], isLoading } = useAnnouncements(eventId);
  const dateFnsLocale = i18n.language?.startsWith('es') ? es : enUS;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{t('subtitle')}</p>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-lg border border-border p-4">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Bell className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(ann => {
            const isExp = expanded[ann.id] ?? false;
            const isLong = ann.body.length > 120;

            return (
              <div
                key={ann.id}
                className="bg-card rounded-lg border border-border p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700"
              >
                <div className="flex gap-3">
                  {/* Megaphone icon */}
                  <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                    <Megaphone className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className="text-base font-semibold text-foreground leading-tight">
                      {ann.title}
                    </h3>

                    {/* Body */}
                    <p
                      className={`text-sm text-muted-foreground mt-1 ${
                        !isExp && isLong ? 'line-clamp-3' : ''
                      }`}
                    >
                      {ann.body}
                    </p>

                    {isLong && (
                      <button
                        onClick={() => toggleExpand(ann.id)}
                        className="text-xs font-medium text-primary mt-1 hover:underline"
                      >
                        {isExp ? t('readLess') : t('readMore')}
                      </button>
                    )}

                    {/* Timestamp + Official badge */}
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary border-0 text-[11px] dark:bg-primary/20">
                        {t('official')}
                      </Badge>
                      {ann.sent_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatAnnouncementTime(ann.sent_at, dateFnsLocale, t('yesterday'))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
