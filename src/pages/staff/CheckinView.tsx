import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  QrCode, Camera, StopCircle, Search, UserPlus, Maximize, Minimize,
  CheckCircle2, AlertTriangle, XCircle, Users, LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { adminStaffService } from '@/services/admin-staff.service';
import {
  useStaffActivities, useActivityCheckins, useTotalAttendees,
  useStaffManualCheckin, useAttendeeSearch,
} from '@/hooks/useAdminCheckinStaff';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, parseISO } from 'date-fns';
import type { StaffMember } from '@/services/admin-staff.service';

type FlashState = 'idle' | 'success' | 'duplicate' | 'error';

export default function StaffCheckinView() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { event, eventSlug } = useEvent();
  const { toast } = useToast();
  const eventId = event?.id;

  const [staffMember, setStaffMember] = useState<StaffMember | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [flashState, setFlashState] = useState<FlashState>('idle');
  const [flashMessage, setFlashMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'staff-portal-qr-reader';

  // Load staff record
  useEffect(() => {
    if (!user?.id || !eventId) return;
    adminStaffService.getStaffByUserId(user.id, eventId).then(record => {
      setStaffMember(record);
      setStaffLoading(false);
      if (!record) {
        navigate(`/${eventSlug}/staff`, { replace: true });
      }
    }).catch(() => {
      setStaffLoading(false);
      navigate(`/${eventSlug}/staff`, { replace: true });
    });
  }, [user?.id, eventId, eventSlug, navigate]);

  const { data: activities, isLoading: loadingActivities } = useStaffActivities(eventId);
  const { data: checkins, isLoading: loadingCheckins } = useActivityCheckins(
    selectedActivityId || undefined,
  );
  const { data: totalAttendees } = useTotalAttendees(eventId);
  const manualCheckin = useStaffManualCheckin();
  const { data: searchResults } = useAttendeeSearch(eventId, manualSearch);

  // Filter activities by assigned room
  const roomActivities = (activities ?? []).filter(a => {
    if (!staffMember?.assigned_room || staffMember.assigned_room === 'General') return true;
    return a.location?.toLowerCase() === staffMember.assigned_room.toLowerCase();
  }).sort((a, b) => {
    const aToday = isToday(parseISO(a.scheduled_date));
    const bToday = isToday(parseISO(b.scheduled_date));
    if (aToday && !bToday) return -1;
    if (!aToday && bToday) return 1;
    return a.scheduled_date.localeCompare(b.scheduled_date) || a.start_time.localeCompare(b.start_time);
  });

  const selectedActivity = activities?.find(a => a.id === selectedActivityId);
  const checkinCount = checkins?.length ?? 0;
  const lastCheckin = checkins?.[0];

  const filteredCheckins = searchQuery
    ? checkins?.filter(c =>
        c.attendee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.credential_code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : checkins;

  const triggerFlash = useCallback((state: FlashState, message: string) => {
    setFlashState(state);
    setFlashMessage(message);
    setTimeout(() => { setFlashState('idle'); setFlashMessage(''); }, 3000);
  }, []);

  // QR Scanner
  const startScanner = useCallback(async () => {
    if (!selectedActivityId) {
      toast({ title: t('checkinStaff.selectSessionFirst'), variant: 'destructive' });
      return;
    }
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          const parts = decodedText.split(':');
          if (parts.length !== 3 || parts[0] !== 'congressapp') {
            triggerFlash('error', t('checkinStaff.invalidQr'));
            return;
          }
          const [, qrEventId, sessionId] = parts;
          if (qrEventId !== eventId) {
            triggerFlash('error', t('checkinStaff.invalidQr'));
            return;
          }
          if (sessionId !== selectedActivityId) {
            triggerFlash('error', t('checkinStaff.wrongSession'));
            return;
          }
          try { await scanner.stop(); } catch { /* ignore */ }
          scannerRef.current = null;
          setScanning(false);
          triggerFlash('success', t('checkinStaff.sessionQrValid'));
        },
        () => {},
      );
    } catch {
      setScanning(false);
      toast({ title: t('checkinStaff.scanError'), variant: 'destructive' });
    }
  }, [selectedActivityId, eventId, triggerFlash, toast, t]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => { if (scannerRef.current) { try { scannerRef.current.stop(); } catch {} } };
  }, []);

  const handleManualCheckin = async (attendeeId: string, attendeeName: string) => {
    if (!selectedActivityId) return;
    try {
      const result = await manualCheckin.mutateAsync({ activityId: selectedActivityId, attendeeId });
      if (result.success) {
        triggerFlash('success', `✅ ${attendeeName} — ${t('checkinStaff.accessGranted')}`);
        setManualDialogOpen(false);
        setManualSearch('');
      } else if (result.error === 'ALREADY_CHECKED_IN') {
        triggerFlash('duplicate', `⚠️ ${attendeeName} — ${t('checkinStaff.alreadyRegistered')}`);
      } else {
        triggerFlash('error', result.message ?? t('checkinStaff.scanError'));
      }
    } catch {
      triggerFlash('error', t('checkinStaff.scanError'));
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(`/${eventSlug}/staff`, { replace: true });
  };

  const flashBorderClass =
    flashState === 'success'
      ? 'border-green-500 shadow-green-500/30 shadow-lg'
      : flashState === 'duplicate'
        ? 'border-yellow-500 shadow-yellow-500/30 shadow-lg'
        : flashState === 'error'
          ? 'border-destructive shadow-destructive/30 shadow-lg'
          : 'border-border';

  if (staffLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isFullscreen ? 'p-4' : ''}`}>
      {/* Header */}
      {!isFullscreen && (
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {staffMember?.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{staffMember?.full_name}</p>
              <div className="flex items-center gap-2">
                {staffMember?.assigned_room && (
                  <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                    {staffMember.assigned_room}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{event?.name}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" />
            {t('layout.logout')}
          </Button>
        </header>
      )}

      <div className={`space-y-4 ${isFullscreen ? '' : 'p-4'}`}>
        {/* Session selector */}
        <div className="max-w-xl">
          <Select value={selectedActivityId} onValueChange={(v) => { setSelectedActivityId(v); stopScanner(); }}>
            <SelectTrigger>
              <SelectValue placeholder={t('checkinStaff.selectSession')} />
            </SelectTrigger>
            <SelectContent>
              {loadingActivities ? (
                <div className="p-2"><Skeleton className="h-6 w-full" /></div>
              ) : roomActivities.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">{t('staffPortal.noSessionsForRoom')}</div>
              ) : (
                roomActivities.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.start_time?.slice(0, 5)} — {a.location ?? ''} — {a.title}
                    {isToday(parseISO(a.scheduled_date)) ? ' ★' : ''}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {!selectedActivityId ? (
          <Card className="max-w-xl">
            <CardContent className="py-12 text-center">
              <QrCode className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('checkinStaff.noSessionSelected')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {flashState !== 'idle' && (
              <div className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all duration-300 ${flashBorderClass}`}>
                {flashState === 'success' && <CheckCircle2 className="h-5 w-5 text-accent" />}
                {flashState === 'duplicate' && <AlertTriangle className="h-5 w-5 text-warning" />}
                {flashState === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                <span>{flashMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* QR Scanner */}
              <Card className={`transition-all duration-300 ${flashBorderClass}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{t('checkinStaff.scanQr')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div
                    id={scannerContainerId}
                    className="relative flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/5"
                    style={{ width: 280, height: 280 }}
                  >
                    {!scanning && (
                      <div className="flex flex-col items-center gap-2">
                        <QrCode className="h-12 w-12 text-accent" />
                        <span className="text-sm text-muted-foreground">{t('checkinStaff.scanQr')}</span>
                      </div>
                    )}
                  </div>
                  {!scanning ? (
                    <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={startScanner}>
                      <Camera className="mr-2 h-4 w-4" />
                      {t('checkinStaff.activateCamera')}
                    </Button>
                  ) : (
                    <Button variant="destructive" className="w-full" onClick={stopScanner}>
                      <StopCircle className="mr-2 h-4 w-4" />
                      {t('checkinStaff.stopCamera')}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Checked-in list */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{t('checkinStaff.attendeesRegistered')}</CardTitle>
                    <span className="text-sm font-medium text-muted-foreground">
                      {checkinCount} / {totalAttendees ?? '—'} {t('checkinStaff.attendeesLabel')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder={t('checkinStaff.searchAttendee')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {loadingCheckins ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                      ))
                    ) : !filteredCheckins || filteredCheckins.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        {t('checkinStaff.noCheckinsYet')}
                      </p>
                    ) : (
                      filteredCheckins.map(c => (
                        <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {c.attendee_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{c.attendee_name}</p>
                            <p className="text-xs text-muted-foreground">{c.credential_code}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {c.checked_in_at ? format(new Date(c.checked_in_at), 'HH:mm') : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setManualDialogOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('checkinStaff.addManually')}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedActivity?.title ?? t('checkinStaff.selectedSession')}</span>
              </div>
              <span className="text-muted-foreground">{t('checkinStaff.checkins')}: {checkinCount}</span>
              {lastCheckin && (
                <span className="text-muted-foreground">
                  {t('checkinStaff.lastEntry')}: {lastCheckin.attendee_name}{' '}
                  {lastCheckin.checked_in_at ? format(new Date(lastCheckin.checked_in_at), 'HH:mm') : ''}
                </span>
              )}
              <div className="ml-auto">
                <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <><Minimize className="mr-1 h-4 w-4" />{t('checkinStaff.exitFullscreen')}</>
                  ) : (
                    <><Maximize className="mr-1 h-4 w-4" />{t('checkinStaff.fullscreen')}</>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Manual check-in dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('checkinStaff.manualCheckinTitle')}</DialogTitle>
            <DialogDescription>{t('checkinStaff.searchByNameOrCode')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder={t('checkinStaff.searchByNameOrCode')}
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {(searchResults ?? []).map(a => (
                <button
                  key={a.id}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left hover:bg-muted transition-colors"
                  onClick={() => handleManualCheckin(a.id, a.full_name)}
                  disabled={manualCheckin.isPending}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {a.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground">{a.credential_code}</p>
                  </div>
                </button>
              ))}
              {manualSearch.length >= 2 && searchResults?.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t('checkinStaff.noResults')}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
