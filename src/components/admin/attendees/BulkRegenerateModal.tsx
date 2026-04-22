import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Loader2,
  Download,
  RefreshCw,
  CheckCircle2,
  Mail,
  XCircle,
  SkipForward,
  RotateCw,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { useEvent } from '@/hooks/useEvent';
import { adminAttendeesService } from '@/services/admin-attendees.service';

type Filter = 'never_logged_in' | 'failed_invitations' | 'all';

interface Counts {
  neverLoggedIn: number;
  failed: number;
  all: number;
}

interface Summary {
  codes_regenerated: number;
  emails_sent: number;
  emails_skipped: number;
  emails_failed: number;
  db_failed: number;
  processed: number;
  failed: number;
  total: number;
  errors: { attendee_id: string; reason: string }[];
}

interface PersistedState {
  filter: Filter;
  offset: number;
  total: number;
  codes_regenerated: number;
  emails_sent: number;
  emails_skipped: number;
  emails_failed: number;
  db_failed: number;
  startedAt: number;
}

interface BulkRegenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: Counts;
}

const STATE_KEY_PREFIX = 'bulk-regen-state-';
const STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function loadPersisted(eventId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY_PREFIX + eventId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.startedAt || Date.now() - parsed.startedAt > STATE_TTL_MS) {
      localStorage.removeItem(STATE_KEY_PREFIX + eventId);
      return null;
    }
    if (parsed.offset >= parsed.total) {
      localStorage.removeItem(STATE_KEY_PREFIX + eventId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePersisted(eventId: string, state: PersistedState) {
  try {
    localStorage.setItem(STATE_KEY_PREFIX + eventId, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

function clearPersisted(eventId: string) {
  try { localStorage.removeItem(STATE_KEY_PREFIX + eventId); } catch { /* ignore */ }
}

export function BulkRegenerateModal({ open, onOpenChange, counts }: BulkRegenerateModalProps) {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('never_logged_in');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [resumeState, setResumeState] = useState<PersistedState | null>(null);

  // Detect interrupted previous run when the modal opens.
  useEffect(() => {
    if (!open || !event?.id) return;
    const persisted = loadPersisted(event.id);
    if (persisted) {
      setResumeState(persisted);
      setFilter(persisted.filter);
    }
  }, [open, event?.id]);

  const reset = useCallback(() => {
    setFilter('never_logged_in');
    setIsRunning(false);
    setProgress({ processed: 0, total: 0 });
    setSummary(null);
    setResumeState(null);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (isRunning) return; // block closing mid-run
      onOpenChange(next);
      if (!next) setTimeout(reset, 300);
    },
    [isRunning, onOpenChange, reset],
  );

  const runRegeneration = useCallback(
    async (selectedFilter: Filter, startOffset: number, seed?: PersistedState) => {
      if (!event?.id) return;
      const eventId = event.id;
      setIsRunning(true);
      setSummary(null);
      setProgress({ processed: startOffset, total: seed?.total ?? 0 });

      try {
        const result = await adminAttendeesService.bulkRegenerateAccessCodes(eventId, {
          filter: selectedFilter,
          sendEmail: true,
          startOffset,
          onProgress: (p) => {
            setProgress({ processed: p.processed + startOffset, total: p.total + startOffset });
            savePersisted(eventId, {
              filter: selectedFilter,
              offset: p.offset,
              total: p.total + startOffset,
              codes_regenerated: (seed?.codes_regenerated ?? 0) + p.codes_regenerated,
              emails_sent: (seed?.emails_sent ?? 0) + p.emails_sent,
              emails_skipped: (seed?.emails_skipped ?? 0) + p.emails_skipped,
              emails_failed: (seed?.emails_failed ?? 0) + p.emails_failed,
              db_failed: (seed?.db_failed ?? 0) + p.db_failed,
              startedAt: seed?.startedAt ?? Date.now(),
            });
          },
        });

        // Merge any seeded counts (from a resumed run) into the final summary.
        const merged: Summary = {
          codes_regenerated: result.codes_regenerated + (seed?.codes_regenerated ?? 0),
          emails_sent: result.emails_sent + (seed?.emails_sent ?? 0),
          emails_skipped: result.emails_skipped + (seed?.emails_skipped ?? 0),
          emails_failed: result.emails_failed + (seed?.emails_failed ?? 0),
          db_failed: result.db_failed + (seed?.db_failed ?? 0),
          processed: result.processed + (seed?.codes_regenerated ?? 0) + (seed?.db_failed ?? 0),
          failed: result.failed + (seed?.emails_failed ?? 0) + (seed?.db_failed ?? 0),
          total: result.total + startOffset,
          errors: result.errors,
        };

        setSummary(merged);
        clearPersisted(eventId);
        setResumeState(null);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
          queryClient.invalidateQueries({ queryKey: ['admin-failed-invitations'] }),
          queryClient.invalidateQueries({ queryKey: ['admin-pending-invitations'] }),
        ]);

        if (merged.emails_failed === 0 && merged.db_failed === 0) {
          toast({
            title: t('attendees.bulkRegenerate.successToast', {
              count: merged.codes_regenerated,
              defaultValue: '{{count}} codes regenerated and emails sent',
            }),
          });
        } else {
          toast({
            title: t('attendees.bulkRegenerate.partialToast', {
              processed: merged.codes_regenerated,
              failed: merged.emails_failed + merged.db_failed,
              defaultValue: 'Done — {{processed}} regenerated, {{failed}} with issues',
            }),
            variant: 'destructive',
          });
        }
      } catch (e) {
        toast({
          title: t('attendees.bulkRegenerate.errorToast', { defaultValue: 'Bulk regeneration failed' }),
          description: (e as Error).message,
          variant: 'destructive',
        });
      } finally {
        setIsRunning(false);
      }
    },
    [event?.id, queryClient, t],
  );

  const handleConfirm = () => runRegeneration(filter, 0);

  const handleResume = () => {
    if (!resumeState) return;
    runRegeneration(resumeState.filter, resumeState.offset, resumeState);
  };

  const handleStartOver = () => {
    if (event?.id) clearPersisted(event.id);
    setResumeState(null);
  };

  const downloadErrors = () => {
    if (!summary?.errors.length) return;
    const csv = 'attendee_id,reason\n' +
      summary.errors.map((e) => `${e.attendee_id},"${e.reason.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulk-regenerate-errors-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount =
    filter === 'never_logged_in' ? counts.neverLoggedIn :
    filter === 'failed_invitations' ? counts.failed :
    counts.all;

  const percent = progress.total > 0
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {t('attendees.bulkRegenerate.title', { defaultValue: 'Bulk regenerate access codes' })}
          </DialogTitle>
          <DialogDescription>
            {t('attendees.bulkRegenerate.description', {
              defaultValue:
                'Due to the high attendee volume, current codes need to be replaced. Each attendee will receive a new email with their updated code. This action is needed only once.',
            })}
          </DialogDescription>
        </DialogHeader>

        {!isRunning && !summary && (
          <>
            {/* Resume banner */}
            {resumeState && (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <RotateCw className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <div className="flex-1 space-y-2">
                    <p className="text-foreground">
                      {t('attendees.bulkRegenerate.resumeBanner', {
                        offset: resumeState.offset,
                        total: resumeState.total,
                        defaultValue:
                          'A previous run was interrupted at {{offset}} of {{total}}. Resume where you left off?',
                      })}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleResume}>
                        {t('attendees.bulkRegenerate.resumeButton', {
                          defaultValue: 'Resume',
                        })}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleStartOver}>
                        {t('attendees.bulkRegenerate.startOverButton', {
                          defaultValue: 'Start over',
                        })}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  {t('attendees.bulkRegenerate.warning', {
                    defaultValue:
                      'This will invalidate the current codes of the selected attendees and send new ones by email. Previous codes will stop working.',
                  })}
                </p>
              </div>
            </div>

            {/* Filter options */}
            <RadioGroup value={filter} onValueChange={(v) => setFilter(v as Filter)} className="gap-3">
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="never_logged_in" id="filter-never" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="filter-never" className="font-medium cursor-pointer">
                    {t('attendees.bulkRegenerate.filterNeverLoggedIn', {
                      defaultValue: 'Only attendees who never logged in (recommended)',
                    })}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('attendees.bulkRegenerate.countLabel', {
                      count: counts.neverLoggedIn,
                      defaultValue: '~{{count}} attendees',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="failed_invitations" id="filter-failed" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="filter-failed" className="font-medium cursor-pointer">
                    {t('attendees.bulkRegenerate.filterFailed', {
                      defaultValue: 'Only attendees with failed invitations',
                    })}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('attendees.bulkRegenerate.countLabel', {
                      count: counts.failed,
                      defaultValue: '~{{count}} attendees',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-destructive/30 p-3">
                <RadioGroupItem value="all" id="filter-all" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="filter-all" className="font-medium cursor-pointer">
                    {t('attendees.bulkRegenerate.filterAll', { defaultValue: 'All attendees' })}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('attendees.bulkRegenerate.countLabel', {
                      count: counts.all,
                      defaultValue: '~{{count}} attendees',
                    })}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </>
        )}

        {isRunning && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {t('attendees.bulkRegenerate.progress', {
                  processed: progress.processed,
                  total: progress.total,
                  percent,
                  defaultValue: '{{processed}} of {{total}} processed ({{percent}}%)',
                })}
              </span>
            </div>
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">
              {t('attendees.bulkRegenerate.progressHint', {
                defaultValue:
                  'Do not close this window. Estimated ~3 minutes for 800 attendees. Progress is saved if interrupted.',
              })}
            </p>
          </div>
        )}

        {summary && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>
                  <strong>{summary.codes_regenerated}</strong>{' '}
                  {t('attendees.bulkRegenerate.summaryCodesRegenerated', {
                    defaultValue: 'codes regenerated',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>
                  <strong>{summary.emails_sent}</strong>{' '}
                  {t('attendees.bulkRegenerate.summaryEmailsSent', {
                    defaultValue: 'emails sent',
                  })}
                </span>
              </div>
              {summary.emails_failed > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span>
                    <strong>{summary.emails_failed}</strong>{' '}
                    {t('attendees.bulkRegenerate.summaryEmailsFailed', {
                      defaultValue: 'emails failed',
                    })}
                  </span>
                </div>
              )}
              {summary.emails_skipped > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SkipForward className="h-4 w-4" />
                  <span>
                    <strong>{summary.emails_skipped}</strong>{' '}
                    {t('attendees.bulkRegenerate.summaryEmailsSkipped', {
                      defaultValue: 'skipped (no/invalid email)',
                    })}
                  </span>
                </div>
              )}
              {summary.db_failed > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span>
                    <strong>{summary.db_failed}</strong>{' '}
                    {t('attendees.bulkRegenerate.summaryDbFailed', {
                      defaultValue: 'database errors',
                    })}
                  </span>
                </div>
              )}
              <p className="text-muted-foreground text-xs pt-1 border-t">
                {t('attendees.bulkRegenerate.summaryTotal', {
                  total: summary.total,
                  defaultValue: 'Total considered: {{total}}',
                })}
              </p>
            </div>
            {summary.errors.length > 0 && (
              <Button variant="outline" size="sm" onClick={downloadErrors}>
                <Download className="mr-2 h-4 w-4" />
                {t('attendees.bulkRegenerate.downloadErrors', { defaultValue: 'Download error report' })}
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          {!isRunning && !summary && !resumeState && (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                {t('attendees.bulkRegenerate.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={selectedCount === 0}
              >
                {t('attendees.bulkRegenerate.confirm', {
                  count: selectedCount,
                  defaultValue: 'Regenerate and send {{count}} emails',
                })}
              </Button>
            </>
          )}
          {!isRunning && !summary && resumeState && (
            <Button variant="ghost" onClick={() => handleClose(false)}>
              {t('attendees.bulkRegenerate.cancel', { defaultValue: 'Cancel' })}
            </Button>
          )}
          {summary && (
            <Button onClick={() => handleClose(false)}>
              {t('attendees.bulkRegenerate.close', { defaultValue: 'Close' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
