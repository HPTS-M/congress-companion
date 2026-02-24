import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { Star, Users } from 'lucide-react';
import type { EventActivity } from '@/types';

const TYPE_COLORS: Record<string, string> = {
  talk: '#1A56A0',
  workshop: '#00B89F',
  other: '#F59E0B',
  ceremony: '#8B5CF6',
  symposium: '#EC4899',
  conference_day: '#6366F1',
  networking: '#14B8A6',
};

const TYPE_LABEL_KEYS: Record<string, string> = {
  talk: 'typeTalk',
  workshop: 'typeWorkshop',
  ceremony: 'typeCeremony',
  other: 'typeOther',
  symposium: 'typeSymposium',
  conference_day: 'typeConferenceDay',
  networking: 'typeNetworking',
};

interface SessionDetailDrawerProps {
  session: EventActivity | null;
  open: boolean;
  onClose: () => void;
  interestCount: number;
  checkinCount: number;
  eventId: string;
}

export function SessionDetailDrawer({ session, open, onClose, interestCount, checkinCount, eventId }: SessionDetailDrawerProps) {
  const { t } = useTranslation('admin');

  if (!session) return null;

  const typeColor = TYPE_COLORS[session.activity_type ?? 'other'] ?? '#94A3B8';
  const qrValue = `congressapp:${eventId}:${session.id}`;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('agenda.detail.title')}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Title & type */}
          <div>
            <h3 className="text-lg font-semibold text-foreground">{session.title}</h3>
            <Badge
              className="mt-1 text-white"
              style={{ backgroundColor: typeColor }}
            >
              {t(`agenda.sessionModal.${TYPE_LABEL_KEYS[session.activity_type ?? 'other']}`)}
            </Badge>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('agenda.detail.schedule')}</p>
              <p className="font-medium text-foreground">
                {session.start_time?.slice(0, 5)} — {session.end_time?.slice(0, 5) ?? '?'}
              </p>
              <p className="text-muted-foreground text-xs">{session.scheduled_date}</p>
            </div>
            {session.location && (
              <div>
                <p className="text-muted-foreground">{t('agenda.detail.room')}</p>
                <p className="font-medium text-foreground">{session.location}</p>
              </div>
            )}
          </div>

          {/* Speaker */}
          {session.speaker_name && (
            <div className="text-sm">
              <p className="text-muted-foreground">{t('agenda.detail.speaker')}</p>
              <p className="font-medium text-foreground">{session.speaker_name}</p>
              {session.speaker_bio && (
                <p className="text-muted-foreground text-xs">{session.speaker_bio}</p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="text-sm">
            <p className="text-muted-foreground">{t('agenda.detail.description')}</p>
            <p className="text-foreground">{session.description || t('agenda.detail.noDescription')}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-muted-foreground">{t('agenda.detail.certificate')}</p>
              <p className="font-semibold text-foreground">
                {session.requires_checkin ? t('agenda.detail.certificateYes') : t('agenda.detail.certificateNo')}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-foreground">{interestCount}</span>
              </div>
              <p className="text-muted-foreground text-xs">{t('agenda.detail.interests')}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Users className="h-4 w-4 text-[hsl(168,76%,36%)]" />
                <span className="font-semibold text-foreground">{checkinCount}</span>
              </div>
              <p className="text-muted-foreground text-xs">{t('agenda.detail.checkins')}</p>
            </div>
          </div>

          {/* Capacity */}
          <div className="text-sm">
            <p className="text-muted-foreground">{t('agenda.detail.capacity')}</p>
            <p className="font-medium text-foreground">
              {session.capacity ?? t('agenda.detail.unlimited')}
            </p>
          </div>

          {/* QR Code */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{t('agenda.detail.qrCode')}</p>
            <div className="flex justify-center rounded-lg border border-border bg-white p-4">
              <QRCodeSVG value={qrValue} size={180} />
            </div>
            <p className="text-center text-xs text-muted-foreground font-mono break-all">{qrValue}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
