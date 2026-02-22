import { useTranslation } from 'react-i18next';
import { Star, Clock, MapPin, User, CheckCircle2, Circle, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EventActivity, ActivityType } from '@/types';

const typeBorderColors: Record<string, string> = {
  talk: '#1A56A0',
  workshop: '#00B89F',
  other: '#F59E0B',
  ceremony: '#8B5CF6',
  networking: '#1A56A0',
};

const typeI18nKeys: Record<string, string> = {
  talk: 'type.conference',
  workshop: 'type.workshop',
  other: 'type.break',
  ceremony: 'type.plenary',
  networking: 'type.conference',
};

interface SessionCardProps {
  activity: EventActivity;
  interestCount: number;
  isInterested: boolean;
  isCheckedIn: boolean;
  onToggleInterest: () => void;
  isToggling: boolean;
}

export function SessionCard({
  activity,
  interestCount,
  isInterested,
  isCheckedIn,
  onToggleInterest,
  isToggling,
}: SessionCardProps) {
  const { t } = useTranslation('agenda');

  const actType = (activity.activity_type ?? 'conference') as string;
  const borderClass = typeBorderColors[actType] ?? typeBorderColors.conference;

  const formatTime = (time: string) => time.slice(0, 5);

  return (
    <div
      className="rounded-lg border border-border border-l-4 bg-card shadow-sm p-4"
      style={{ borderLeftColor: typeBorderColors[actType] ?? '#1A56A0' }}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title + interest count */}
          <div className="flex items-start gap-2">
            <h3 className="text-base font-semibold text-card-foreground leading-tight">
              {activity.title}
            </h3>
            {interestCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-amber-500 shrink-0 mt-0.5">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {interestCount}
              </span>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {formatTime(activity.start_time)}
              {activity.end_time ? ` - ${formatTime(activity.end_time)}` : ''}
            </span>
          </div>

          {/* Location */}
          {activity.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{activity.location}</span>
            </div>
          )}

          {/* Speaker */}
          {activity.speaker_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{activity.speaker_name}</span>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {actType && typeI18nKeys[actType] && (
              <Badge variant="secondary" className="text-[11px] font-medium">
                {t(typeI18nKeys[actType])}
              </Badge>
            )}
            {activity.requires_checkin && (
              <Badge variant="outline" className="text-[11px] font-medium gap-1">
                <Award className="h-3 w-3" />
                {t('session.certificate')}
              </Badge>
            )}
          </div>
        </div>

        {/* Right — attendance indicator */}
        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
          {isCheckedIn ? (
            <CheckCircle2 className="h-6 w-6 text-[hsl(170,100%,36%)]" />
          ) : (
            <Circle className="h-6 w-6 text-muted-foreground/40" />
          )}
          <span className="text-[10px] text-muted-foreground">
            {isCheckedIn ? t('session.confirmed') : t('session.pending')}
          </span>
        </div>
      </div>

      {/* Bottom — interest toggle */}
      <div className="mt-3 flex justify-end">
        <Button
          variant={isInterested ? 'default' : 'outline'}
          size="sm"
          disabled={isToggling}
          onClick={onToggleInterest}
          className={cn(
            'text-xs gap-1.5',
            isInterested && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
          )}
        >
          <Star className={cn('h-3.5 w-3.5', isInterested && 'fill-white')} />
          {isInterested ? t('session.teInteresa') : t('session.meInteresa')}
        </Button>
      </div>
    </div>
  );
}
