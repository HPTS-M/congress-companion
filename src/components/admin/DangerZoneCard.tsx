import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEvent } from '@/hooks/useEvent';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface PurgeReport {
  dry_run: boolean;
  event: { id: string; event_code: string; name: string };
  will_delete?: Record<string, number>;
  deleted?: Record<string, number>;
  remaining?: Record<string, number>;
  error?: string;
}

export function DangerZoneCard() {
  const { t } = useTranslation('admin');
  const { event, eventSlug } = useEvent();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [stage, setStage] = useState<'input' | 'preview' | 'done'>('input');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PurgeReport | null>(null);

  // Only superusers should see this — checked via role lookup
  const [isSuperuser, setIsSuperuser] = useState<boolean | null>(null);
  if (isSuperuser === null && user) {
    supabase
      .rpc('get_user_roles', { _user_id: user.id })
      .then(({ data }) => setIsSuperuser((data ?? []).includes('superuser')));
  }
  if (!isSuperuser) return null;
  if (!event) return null;

  const codeMatches = confirmCode.trim() === event.event_code;

  const reset = () => {
    setOpen(false);
    setConfirmCode('');
    setStage('input');
    setReport(null);
    setLoading(false);
  };

  const callPurge = async (confirm: boolean): Promise<PurgeReport> => {
    const { data, error } = await supabase.functions.invoke('purge-event-attendees', {
      body: { event_id: event.id, confirm, delete_auth_users: true },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data as PurgeReport;
  };

  const handlePreview = async () => {
    if (!codeMatches) return;
    setLoading(true);
    try {
      const result = await callPurge(false);
      setReport(result);
      setStage('preview');
    } catch (err) {
      toast({
        title: t('settings.dangerZone.error'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await callPurge(true);
      setReport(result);
      setStage('done');
      // Invalidate everything attendee-related
      queryClient.invalidateQueries();
      toast({ title: t('settings.dangerZone.successTitle') });
    } catch (err) {
      toast({
        title: t('settings.dangerZone.error'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCounts = (counts: Record<string, number> | undefined) => {
    if (!counts) return null;
    const entries = Object.entries(counts).filter(([, v]) => v > 0);
    if (entries.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">{t('settings.dangerZone.nothingToDelete')}</p>
      );
    }
    return (
      <div className="space-y-1 max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3">
        {entries.map(([table, count]) => (
          <div key={table} className="flex justify-between text-sm">
            <span className="font-mono text-muted-foreground">{table}</span>
            <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('settings.dangerZone.title')}
          </CardTitle>
          <CardDescription>{t('settings.dangerZone.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <div>
              <p className="font-medium text-foreground">
                {t('settings.dangerZone.purgeAttendees')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('settings.dangerZone.purgeAttendeesDescription')}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setOpen(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {t('settings.dangerZone.purgeButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {stage === 'done'
                ? t('settings.dangerZone.successTitle')
                : t('settings.dangerZone.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {stage === 'input' && (
                  <>
                    <p>
                      {t('settings.dangerZone.confirmDescription', {
                        eventName: event.name,
                        eventCode: event.event_code,
                      })}
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="purge-confirm-code">
                        {t('settings.dangerZone.typeCode', { code: event.event_code })}
                      </Label>
                      <Input
                        id="purge-confirm-code"
                        value={confirmCode}
                        onChange={(e) => setConfirmCode(e.target.value)}
                        placeholder={event.event_code}
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}
                {stage === 'preview' && report?.will_delete && (
                  <>
                    <p className="font-medium text-foreground">
                      {t('settings.dangerZone.previewIntro')}
                    </p>
                    {renderCounts(report.will_delete)}
                    <p className="text-destructive font-medium">
                      {t('settings.dangerZone.previewWarning')}
                    </p>
                  </>
                )}
                {stage === 'done' && report?.deleted && (
                  <>
                    <p className="font-medium text-foreground">
                      {t('settings.dangerZone.deletedIntro')}
                    </p>
                    {renderCounts(report.deleted)}
                    {report.remaining && (
                      <>
                        <p className="font-medium text-foreground mt-3">
                          {t('settings.dangerZone.remainingIntro')}
                        </p>
                        {renderCounts(report.remaining)}
                      </>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {stage === 'input' && (
              <>
                <AlertDialogCancel disabled={loading}>
                  {t('settings.dangerZone.cancel')}
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={!codeMatches || loading}
                  onClick={handlePreview}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('settings.dangerZone.preview')}
                </Button>
              </>
            )}
            {stage === 'preview' && (
              <>
                <AlertDialogCancel disabled={loading}>
                  {t('settings.dangerZone.cancel')}
                </AlertDialogCancel>
                <Button variant="destructive" disabled={loading} onClick={handleConfirm}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('settings.dangerZone.executeNow')}
                </Button>
              </>
            )}
            {stage === 'done' && (
              <AlertDialogAction onClick={reset}>
                {t('settings.dangerZone.close')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
