import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QRCodeSVG } from 'qrcode.react';
import { Star, Users, BarChart3, Plus, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminPollsService, type Poll } from '@/services/admin-polls.service';
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

const STATUS_COLORS: Record<string, string> = {
  draft: 'border-slate-300 text-slate-500',
  active: 'border-teal-300 text-teal-700 bg-teal-50',
  closed: 'border-blue-300 text-blue-700 bg-blue-50',
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
  const [sessionPolls, setSessionPolls] = useState<Poll[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [unlinkedPolls, setUnlinkedPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (open && session && eventId) {
      setLoadingPolls(true);
      adminPollsService.getPollsBySession(eventId, session.id)
        .then(setSessionPolls)
        .catch(() => setSessionPolls([]))
        .finally(() => setLoadingPolls(false));
    } else {
      setSessionPolls([]);
    }
  }, [open, session?.id, eventId]);

  const handleOpenLink = async () => {
    try {
      const polls = await adminPollsService.getUnlinkedPolls(eventId);
      setUnlinkedPolls(polls);
      setSelectedPollId('');
      setLinkDialogOpen(true);
    } catch { /* ignore */ }
  };

  const handleLinkPoll = async () => {
    if (!selectedPollId || !session) return;
    setLinking(true);
    try {
      await adminPollsService.linkPollToSession(selectedPollId, session.id);
      const updated = await adminPollsService.getPollsBySession(eventId, session.id);
      setSessionPolls(updated);
      setLinkDialogOpen(false);
    } catch { /* ignore */ }
    setLinking(false);
  };

  if (!session) return null;

  const typeColor = TYPE_COLORS[session.activity_type ?? 'other'] ?? '#94A3B8';
  const qrValue = `congressapp:${eventId}:${session.id}`;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('agenda.detail.title')}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Title & type */}
            <div>
              <h3 className="text-lg font-semibold text-foreground">{session.title}</h3>
              <Badge className="mt-1 text-white" style={{ backgroundColor: typeColor }}>
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

            {/* Polls Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" />
                  {t('agenda.detail.polls')}
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleOpenLink}>
                    <Link2 className="mr-1 h-3 w-3" />{t('agenda.detail.linkPoll')}
                  </Button>
                </div>
              </div>

              {loadingPolls ? (
                <Skeleton className="h-12 w-full" />
              ) : sessionPolls.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('agenda.detail.noPolls')}</p>
              ) : (
                <div className="space-y-2">
                  {sessionPolls.map(poll => (
                    <div key={poll.id} className="rounded-lg border border-border p-2.5 text-sm">
                      <p className="font-medium line-clamp-2">{poll.question}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[poll.status] ?? ''}`}>
                          {t(`polls.status_${poll.status}`)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {t(`polls.${poll.poll_type === 'single_choice' ? 'typeSingle' : poll.poll_type === 'multiple_choice' ? 'typeMultiple' : poll.poll_type === 'rating_scale' ? 'typeRating' : 'typeOpen'}`)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Link Poll Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('agenda.detail.linkPoll')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {unlinkedPolls.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agenda.detail.noUnlinkedPolls')}</p>
            ) : (
              <>
                <Select value={selectedPollId} onValueChange={setSelectedPollId}>
                  <SelectTrigger><SelectValue placeholder={t('agenda.detail.selectPoll')} /></SelectTrigger>
                  <SelectContent>
                    {unlinkedPolls.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.question.length > 50 ? p.question.slice(0, 50) + '…' : p.question}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>{t('polls.cancel')}</Button>
                  <Button onClick={handleLinkPoll} disabled={!selectedPollId || linking} className="bg-[hsl(var(--primary))]">
                    {linking ? t('polls.saving') : t('agenda.detail.linkPoll')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
