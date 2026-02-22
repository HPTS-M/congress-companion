import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, CheckCircle2, Camera, StopCircle } from 'lucide-react';
import { useEvent } from '@/hooks/useEvent';
import { useAuth } from '@/hooks/useAuth';
import { useRecentCheckins, usePerformCheckin, useEventActivities } from '@/hooks/useCheckin';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

export default function CheckIn() {
  const { t } = useTranslation('checkin');
  const { event } = useEvent();
  const { attendee } = useAuth();
  const { toast } = useToast();
  const eventId = event?.id;
  const attendeeId = attendee?.id;

  const { data: recentCheckins, isLoading: loadingRecent } = useRecentCheckins(attendeeId);
  const checkinMutation = usePerformCheckin(attendeeId);
  const { data: activities } = useEventActivities(eventId);

  const [scanning, setScanning] = useState(false);
  const [simDialogOpen, setSimDialogOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'qr-reader';

  const handleCheckinResult = useCallback(
    async (activityId: string) => {
      if (!attendeeId) return;
      try {
        const result = await checkinMutation.mutateAsync({ activityId });
        if (result.success) {
          toast({
            title: t('success'),
            description: result.message ?? t('successWithTitle', { title: '' }),
          });
        } else if (result.error === 'ALREADY_CHECKED_IN') {
          toast({
            title: t('alreadyCheckedIn'),
            variant: 'destructive',
          });
        } else {
          toast({ title: t('error'), description: result.message, variant: 'destructive' });
        }
      } catch {
        toast({ title: t('error'), variant: 'destructive' });
      }
    },
    [attendeeId, checkinMutation, toast, t],
  );

  const startScanner = useCallback(async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // Parse: congressapp:{event_id}:{session_id}
          const parts = decodedText.split(':');
          if (parts.length !== 3 || parts[0] !== 'congressapp') {
            toast({ title: t('invalidQr'), variant: 'destructive' });
            return;
          }
          const [, qrEventId, sessionId] = parts;
          if (qrEventId !== eventId) {
            toast({ title: t('wrongEvent'), variant: 'destructive' });
            return;
          }
          // Stop scanner and process
          scanner.stop().then(() => {
            scannerRef.current = null;
            setScanning(false);
          });
          handleCheckinResult(sessionId);
        },
        () => {
          // ignore scan errors (no QR found yet)
        },
      );
    } catch {
      setScanning(false);
      toast({ title: t('error'), variant: 'destructive' });
    }
  }, [eventId, handleCheckinResult, toast, t]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleSimulate = () => {
    setSimDialogOpen(true);
  };

  const confirmSimulate = () => {
    if (!selectedActivityId) return;
    setSimDialogOpen(false);
    handleCheckinResult(selectedActivityId);
    setSelectedActivityId('');
  };

  return (
    <div className="space-y-6 px-4 py-4">
      {/* Page header */}
      <div className="px-4 pt-4">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Main scan card */}
      <div className="flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">{t('scanTitle')}</CardTitle>
            <CardDescription>{t('scanSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {/* Camera viewport */}
            <div
              id={scannerContainerId}
              className="relative flex items-center justify-center rounded-lg border-2 border-dashed"
              style={{
                width: 280,
                height: 280,
                borderColor: '#00B89F',
                backgroundColor: 'rgba(0, 184, 159, 0.05)',
              }}
            >
              {!scanning && (
                <div className="flex flex-col items-center gap-2">
                  <QrCode className="h-12 w-12" style={{ color: '#00B89F' }} />
                  <span className="text-sm text-muted-foreground">{t('cameraPlaceholder')}</span>
                </div>
              )}
            </div>

            {/* Scan button */}
            {!scanning ? (
              <Button
                className="w-full text-white"
                style={{ backgroundColor: '#00B89F' }}
                onClick={startScanner}
                disabled={checkinMutation.isPending}
              >
                <Camera className="mr-2 h-4 w-4" />
                {t('scanButton')}
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="w-full"
                onClick={stopScanner}
              >
                <StopCircle className="mr-2 h-4 w-4" />
                {t('stopScan')}
              </Button>
            )}

            {/* Dev simulate button */}
            {DEV_MODE && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSimulate}
                disabled={checkinMutation.isPending}
              >
                {t('simulateScan')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent check-ins */}
      <div className="mx-auto max-w-md">
        <h2 className="mb-3 text-base font-semibold text-foreground">{t('recentTitle')}</h2>
        {loadingRecent ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : !recentCheckins || recentCheckins.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noRecentCheckins')}</p>
        ) : (
          <div className="space-y-2">
            {recentCheckins.map((ci) => (
              <div
                key={ci.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#00B89F' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {ci.activity_title}
                  </p>
                  {ci.checked_in_at && (
                    <p className="text-xs text-muted-foreground">
                      {t('checkedInAt', { time: format(new Date(ci.checked_in_at), 'HH:mm') })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Simulate dialog */}
      <Dialog open={simDialogOpen} onOpenChange={setSimDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('simulateScan')}</DialogTitle>
            <DialogDescription>{t('simulatePrompt')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectActivity')} />
              </SelectTrigger>
              <SelectContent>
                {(activities ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSimDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                onClick={confirmSimulate}
                disabled={!selectedActivityId || checkinMutation.isPending}
                style={{ backgroundColor: '#00B89F' }}
                className="text-white"
              >
                {t('confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
