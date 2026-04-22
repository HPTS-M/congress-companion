import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Download, RefreshCw } from 'lucide-react';
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

interface BulkRegenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: Counts;
}

export function BulkRegenerateModal({ open, onOpenChange, counts }: BulkRegenerateModalProps) {
  const { t } = useTranslation('admin');
  const { event } = useEvent();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('never_logged_in');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [summary, setSummary] = useState<{
    processed: number;
    failed: number;
    total: number;
    errors: { attendee_id: string; reason: string }[];
  } | null>(null);

  const reset = useCallback(() => {
    setFilter('never_logged_in');
    setIsRunning(false);
    setProgress({ processed: 0, total: 0 });
    setSummary(null);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (isRunning) return; // block closing mid-run
      onOpenChange(next);
      if (!next) setTimeout(reset, 300);
    },
    [isRunning, onOpenChange, reset],
  );

  const handleConfirm = async () => {
    if (!event?.id) return;
    setIsRunning(true);
    setSummary(null);
    setProgress({ processed: 0, total: 0 });
    try {
      const result = await adminAttendeesService.bulkRegenerateAccessCodes(event.id, {
        filter,
        sendEmail: true,
        onProgress: (p) => setProgress(p),
      });
      setSummary(result);
      // Refresh attendee data so the UI reflects new invitation_sent_at, etc.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-attendees'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-failed-invitations'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-pending-invitations'] }),
      ]);
      if (result.failed === 0) {
        toast({
          title: t('attendees.bulkRegenerate.successToast', {
            count: result.processed,
            defaultValue: '{{count}} codes regenerated and emails sent',
          }),
        });
      } else {
        toast({
          title: t('attendees.bulkRegenerate.partialToast', {
            processed: result.processed,
            failed: result.failed,
            defaultValue: 'Done — {{processed}} processed, {{failed}} with issues',
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
                defaultValue: 'Do not close this window. Estimated ~7-10 minutes for 800 attendees.',
              })}
            </p>
          </div>
        )}

        {summary && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
              <p>
                <strong>{summary.processed}</strong>{' '}
                {t('attendees.bulkRegenerate.summaryProcessed', { defaultValue: 'codes regenerated' })}
              </p>
              {summary.failed > 0 && (
                <p className="text-destructive">
                  <strong>{summary.failed}</strong>{' '}
                  {t('attendees.bulkRegenerate.summaryFailed', { defaultValue: 'failed (see CSV)' })}
                </p>
              )}
              <p className="text-muted-foreground">
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
          {!isRunning && !summary && (
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
