import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { useAuth } from '@/hooks/useAuth';
import {
  useActivities,
  useSessionInterests,
  useUserInterests,
  useUserCheckins,
  useToggleInterest,
} from '@/hooks/useAgenda';
import { DaySelector } from '@/components/attendee/DaySelector';
import { SessionCard } from '@/components/attendee/SessionCard';
import { SessionSkeleton } from '@/components/attendee/SessionSkeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Agenda() {
  const { t } = useTranslation('agenda');
  const { event } = useEvent();
  const { attendee } = useAuth();
  const eventId = event?.id;
  const attendeeId = attendee?.id;

  const { grouped, sortedDates, isLoading, error, refetch } = useActivities(eventId);
  const { countMap } = useSessionInterests(eventId);
  const { sessionIds: interestedIds } = useUserInterests(eventId, attendeeId);
  const { checkedInIds } = useUserCheckins(attendeeId);
  const toggleMutation = useToggleInterest(eventId, attendeeId);

  const [selectedDate, setSelectedDate] = useState<string>('');

  // Auto-select first date when data arrives
  useEffect(() => {
    if (sortedDates.length > 0 && !sortedDates.includes(selectedDate)) {
      setSelectedDate(sortedDates[0]);
    }
  }, [sortedDates, selectedDate]);

  const sessions = grouped.get(selectedDate) ?? [];

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="px-4 pt-4">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <SessionSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{t('error')}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t('retry', { ns: 'common', defaultValue: 'Reintentar' })}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Day selector */}
      {sortedDates.length > 0 && (
        <DaySelector
          dates={sortedDates}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
      )}

      {/* Sessions list */}
      <div className="space-y-3 px-4 py-4">
        {sessions.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t('noSessions')}
          </p>
        ) : (
          sessions.map((activity) => (
            <SessionCard
              key={activity.id}
              activity={activity}
              interestCount={countMap.get(activity.id) ?? 0}
              isInterested={interestedIds.has(activity.id)}
              isCheckedIn={checkedInIds.has(activity.id)}
              onToggleInterest={() =>
                toggleMutation.mutate({
                  sessionId: activity.id,
                  isInterested: interestedIds.has(activity.id),
                })
              }
              isToggling={toggleMutation.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
