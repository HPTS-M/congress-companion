import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from '@/hooks/useEvent';
import { useAuth } from '@/hooks/useAuth';
import { useActivities } from '@/hooks/useAgenda';
import { useUserRatings, useSubmitRating } from '@/hooks/useRatings';
import { DaySelector } from '@/components/attendee/DaySelector';
import { SessionSkeleton } from '@/components/attendee/SessionSkeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Star, Clock, MapPin, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { EventActivity } from '@/types';

const RATABLE_TYPES = ['talk', 'workshop', 'ceremony'];

function StarRating({
  value,
  onChange,
  interactive = false,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  interactive?: boolean;
  size?: number;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
        >
          <Star
            size={size}
            className={
              star <= value
                ? 'fill-[#F59E0B] text-[#F59E0B]'
                : 'text-muted-foreground'
            }
          />
        </button>
      ))}
    </div>
  );
}

export default function Ratings() {
  const { t } = useTranslation('ratings');
  const { event } = useEvent();
  const { attendee } = useAuth();
  const { toast } = useToast();
  const eventId = event?.id;
  const attendeeId = attendee?.id;

  const { grouped, sortedDates, isLoading } = useActivities(eventId);
  const { ratingsMap } = useUserRatings(eventId, attendeeId);
  const submitMutation = useSubmitRating(eventId, attendeeId);

  const [selectedDate, setSelectedDate] = useState('');
  const [modalSession, setModalSession] = useState<EventActivity | null>(null);
  const [modalStars, setModalStars] = useState(0);
  const [modalComment, setModalComment] = useState('');

  useEffect(() => {
    if (sortedDates.length > 0 && !sortedDates.includes(selectedDate)) {
      setSelectedDate(sortedDates[0]);
    }
  }, [sortedDates, selectedDate]);

  // Filter ratable sessions for current day
  const ratableSessions = useMemo(() => {
    const daySessions = grouped.get(selectedDate) ?? [];
    return daySessions.filter(
      (a) => a.activity_type && RATABLE_TYPES.includes(a.activity_type),
    );
  }, [grouped, selectedDate]);

  // All ratable sessions across all days for summary
  const allRatable = useMemo(() => {
    const all: EventActivity[] = [];
    for (const sessions of grouped.values()) {
      for (const s of sessions) {
        if (s.activity_type && RATABLE_TYPES.includes(s.activity_type)) {
          all.push(s);
        }
      }
    }
    return all;
  }, [grouped]);

  const ratedCount = allRatable.filter((s) => ratingsMap.has(s.id)).length;
  const totalRatable = allRatable.length;
  const avgRating = useMemo(() => {
    const ratings = Array.from(ratingsMap.values());
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length;
  }, [ratingsMap]);

  const openModal = (session: EventActivity) => {
    const existing = ratingsMap.get(session.id);
    setModalSession(session);
    setModalStars(existing?.stars ?? 0);
    setModalComment(existing?.comment ?? '');
  };

  const handleSubmit = async () => {
    if (!modalSession || modalStars === 0) return;
    await submitMutation.mutateAsync({
      sessionId: modalSession.id,
      stars: modalStars,
      comment: modalComment.trim() || null,
    });
    toast({ title: t('modal.success') });
    setModalSession(null);
  };

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

  return (
    <div className="space-y-0">
      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Summary Card */}
      {totalRatable > 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('summary.rated', { count: ratedCount, total: totalRatable })}
          </p>
          <Progress value={(ratedCount / totalRatable) * 100} className="h-2" />
          {ratedCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('summary.average')}:</span>
              <Star size={16} className="fill-[#F59E0B] text-[#F59E0B]" />
              <span className="font-semibold text-foreground">
                {avgRating.toFixed(1)} / 5
              </span>
            </div>
          )}
        </div>
      )}

      {/* Day Selector */}
      {sortedDates.length > 0 && (
        <DaySelector dates={sortedDates} selectedDate={selectedDate} onSelect={setSelectedDate} />
      )}

      {/* Session List */}
      <div className="space-y-3 px-4 py-4">
        {ratableSessions.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('noSessions')}</p>
        ) : (
          ratableSessions.map((session) => {
            const rating = ratingsMap.get(session.id);
            const isRated = !!rating;

            return (
              <div
                key={session.id}
                className="rounded-lg border border-border bg-card p-4 space-y-2"
              >
                <h3 className="text-[15px] font-bold text-foreground">{session.title}</h3>
                {session.speaker_name && (
                  <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <User size={13} />
                    <span>{session.speaker_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {session.start_time?.slice(0, 5)}
                    {session.end_time ? ` - ${session.end_time.slice(0, 5)}` : ''}
                  </span>
                  {session.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {session.location}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <StarRating value={isRated ? rating.stars : 0} size={20} />
                  {isRated ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                      {t('card.rated')}
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[hsl(213,72%,37%)] border-[hsl(213,72%,37%)]"
                      onClick={() => openModal(session)}
                    >
                      {t('card.rate')}
                    </Button>
                  )}
                </div>

                {isRated && rating.comment && (
                  <p className="text-xs text-muted-foreground line-clamp-2 italic">
                    "{rating.comment}"
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Rating Modal */}
      <Dialog open={!!modalSession} onOpenChange={(open) => !open && setModalSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('modal.title')}</DialogTitle>
          </DialogHeader>
          {modalSession && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">{modalSession.title}</h3>

              <div className="flex justify-center py-2">
                <StarRating value={modalStars} onChange={setModalStars} interactive size={36} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('modal.commentLabel')}
                </label>
                <Textarea
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder={t('modal.commentPlaceholder')}
                  rows={3}
                />
              </div>

              <Button
                className="w-full bg-[hsl(213,72%,37%)] hover:bg-[hsl(213,72%,32%)] text-white"
                onClick={handleSubmit}
                disabled={modalStars === 0 || submitMutation.isPending}
              >
                {t('modal.submit')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
