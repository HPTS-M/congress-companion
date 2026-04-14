import { useTranslation } from 'react-i18next';
import { Users, ScanLine, FolderOpen, Megaphone, Calendar, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useEvent } from '@/hooks/useEvent';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { format, isToday, isYesterday } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';


interface MetricCardProps {
  title: string;
  value: number | undefined;
  icon: React.ElementType;
  loading: boolean;
}

function MetricCard({ title, value, icon: Icon, loading }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { t, i18n } = useTranslation('admin');
  const { t: tAnn } = useTranslation('announcements');
  const navigate = useNavigate();
  const { event, eventSlug } = useEvent();
  const dateFnsLocale = i18n.language?.startsWith('es') ? esLocale : enUS;
  const { stats, recentAnnouncements } = useAdminDashboard(event?.id);

  const metrics = [
    { key: 'totalAttendees', icon: Users, value: stats.data?.totalAttendees },
    { key: 'checkedIn', icon: ScanLine, value: stats.data?.totalCheckins },
    { key: 'documents', icon: FolderOpen, value: stats.data?.totalDocuments },
    { key: 'announcements', icon: Megaphone, value: stats.data?.totalAnnouncements },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
        {event && (
          <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <MetricCard
            key={m.key}
            title={t(`dashboard.${m.key}`)}
            value={m.value}
            icon={m.icon}
            loading={stats.isLoading}
          />
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAnnouncements.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentAnnouncements.data && recentAnnouncements.data.length > 0 ? (
            <ul className="space-y-3">
              {recentAnnouncements.data.map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-sm">
                  <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground truncate">{a.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                    {a.sent_at ? (() => {
                      const d = new Date(a.sent_at);
                      const time = format(d, 'HH:mm', { locale: dateFnsLocale });
                      if (isToday(d)) return time;
                      if (isYesterday(d)) return `${tAnn('yesterday')} · ${time}`;
                      return `${format(d, 'eee d MMM', { locale: dateFnsLocale })} · ${time}`;
                    })() : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(`/${eventSlug}/admin/config`)}
        >
          <Settings className="mr-2 h-4 w-4" />
          {t('nav.config')}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/${eventSlug}/admin/communications`)}
        >
          <Send className="mr-2 h-4 w-4" />
          {t('dashboard.sendAnnouncement')}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/${eventSlug}/admin/agenda`)}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {t('dashboard.viewAgenda')}
        </Button>
      </div>
    </div>
  );
}
