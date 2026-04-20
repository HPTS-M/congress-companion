import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, AlertCircle, CheckCircle2, RotateCcw, XCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { AttendeeWithServices } from '@/services/admin-attendees.service';

interface BulkSendCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAttendees: AttendeeWithServices[];
  isSending: boolean;
  onConfirm: (validIds: string[]) => Promise<void> | void;
  /** Optional set of attendee IDs whose last invitation attempt failed. */
  failedIds?: Set<string>;
}

const PREVIEW_LIMIT = 10;

function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function BulkSendCredentialsModal({
  open,
  onOpenChange,
  selectedAttendees,
  isSending,
  onConfirm,
  failedIds,
}: BulkSendCredentialsModalProps) {
  const { t } = useTranslation('admin');
  const [resendInvited, setResendInvited] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // ---- Compute breakdown ----
  const breakdown = useMemo(() => {
    const noEmail: AttendeeWithServices[] = [];
    const cancelled: AttendeeWithServices[] = [];
    const alreadyInvited: AttendeeWithServices[] = [];
    const readyFirstTime: AttendeeWithServices[] = [];
    const failed: AttendeeWithServices[] = [];

    for (const a of selectedAttendees) {
      if (a.registration_status === 'cancelled') {
        cancelled.push(a);
        continue;
      }
      if (!isValidEmail(a.email)) {
        noEmail.push(a);
        continue;
      }
      if (failedIds?.has(a.id)) {
        failed.push(a);
        continue;
      }
      if (a.invitation_sent_at) {
        alreadyInvited.push(a);
      } else {
        readyFirstTime.push(a);
      }
    }
    return { noEmail, cancelled, alreadyInvited, readyFirstTime, failed };
  }, [selectedAttendees, failedIds]);

  const recipientsToSend = useMemo(() => {
    // Always include first-timers and previously failed; add already-invited only on opt-in
    return resendInvited
      ? [...breakdown.readyFirstTime, ...breakdown.failed, ...breakdown.alreadyInvited]
      : [...breakdown.readyFirstTime, ...breakdown.failed];
  }, [breakdown, resendInvited]);

  const previewList = showAll ? recipientsToSend : recipientsToSend.slice(0, PREVIEW_LIMIT);
  const hiddenCount = recipientsToSend.length - previewList.length;

  const canSend = recipientsToSend.length > 0 && !isSending;

  const handleConfirm = async () => {
    if (!canSend) return;
    await onConfirm(recipientsToSend.map((a) => a.id));
  };

  const handleClose = (next: boolean) => {
    if (isSending) return; // prevent closing mid-send
    if (!next) {
      setResendInvited(false);
      setShowAll(false);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t('attendees.bulkSendModal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('attendees.bulkSendModal.summary', { count: selectedAttendees.length })}
          </DialogDescription>
        </DialogHeader>

        {/* Breakdown */}
        <div className="space-y-2">
          <BreakdownRow
            icon={<CheckCircle2 className="h-4 w-4 text-accent" />}
            label={t('attendees.bulkSendModal.readyToSend')}
            count={breakdown.readyFirstTime.length}
            tone="accent"
          />
          {breakdown.failed.length > 0 && (
            <BreakdownRow
              icon={<AlertCircle className="h-4 w-4 text-destructive" />}
              label={t('attendees.invitations.failed')}
              count={breakdown.failed.length}
              tone="warning"
            />
          )}
          {breakdown.alreadyInvited.length > 0 && (
            <BreakdownRow
              icon={<RotateCcw className="h-4 w-4 text-amber-500" />}
              label={t('attendees.bulkSendModal.alreadyInvited')}
              count={breakdown.alreadyInvited.length}
              tone="warning"
            />
          )}
          {breakdown.noEmail.length > 0 && (
            <BreakdownRow
              icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
              label={t('attendees.bulkSendModal.excludedNoEmail')}
              count={breakdown.noEmail.length}
              tone="muted"
            />
          )}
          {breakdown.cancelled.length > 0 && (
            <BreakdownRow
              icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
              label={t('attendees.bulkSendModal.excludedCancelled')}
              count={breakdown.cancelled.length}
              tone="muted"
            />
          )}
        </div>

        {/* Resend toggle */}
        {breakdown.alreadyInvited.length > 0 && (
          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="resend-toggle"
              checked={resendInvited}
              onCheckedChange={(c) => setResendInvited(c === true)}
              disabled={isSending}
            />
            <div className="grid gap-1 leading-tight">
              <Label htmlFor="resend-toggle" className="cursor-pointer text-sm font-medium">
                {t('attendees.bulkSendModal.resendToggle')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('attendees.bulkSendModal.resendToggleHint')}
              </p>
            </div>
          </div>
        )}

        {/* Preview list */}
        {recipientsToSend.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {t('attendees.bulkSendModal.recipientsTitle', { count: recipientsToSend.length })}
              </p>
              {recipientsToSend.length > PREVIEW_LIMIT && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-xs"
                  onClick={() => setShowAll((s) => !s)}
                >
                  {showAll
                    ? t('attendees.bulkSendModal.showLess')
                    : t('attendees.bulkSendModal.showAll')}
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-48 rounded-md border">
              <ul className="divide-y">
                {previewList.map((a) => {
                  const isFailed = failedIds?.has(a.id);
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                      </div>
                      {isFailed ? (
                        <Badge variant="destructive" className="shrink-0 text-[10px]">
                          {t('attendees.invitations.statusFailed')}
                        </Badge>
                      ) : a.invitation_sent_at ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {t('attendees.bulkSendModal.resendBadge')}
                        </Badge>
                      ) : null}
                    </li>
                  );
                })}
                {hiddenCount > 0 && (
                  <li className="px-3 py-2 text-center text-xs text-muted-foreground">
                    {t('attendees.bulkSendModal.andMore', { count: hiddenCount })}
                  </li>
                )}
              </ul>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{t('attendees.bulkSendModal.noEligible')}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isSending}>
            {t('attendees.deleteConfirm.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!canSend}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('attendees.sendingInvitation')}
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {t('attendees.bulkSendModal.confirmButton', { count: recipientsToSend.length })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BreakdownRowProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: 'accent' | 'warning' | 'muted';
}

function BreakdownRow({ icon, label, count, tone }: BreakdownRowProps) {
  const toneClass =
    tone === 'accent'
      ? 'text-foreground'
      : tone === 'warning'
        ? 'text-foreground'
        : 'text-muted-foreground';
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
      <div className={`flex items-center gap-2 text-sm ${toneClass}`}>
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums">{count}</span>
    </div>
  );
}
