import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Search, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { providerPortalService, type ProviderSession } from '@/services/provider-portal.service';
import { writeExcelFile } from '@/lib/excel';

export default function ProviderServiceAttendees() {
  const { t } = useTranslation('provider');
  const { eventSlug, serviceId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<ProviderSession | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadSession = async () => {
      const s = await providerPortalService.getProviderSession();
      if (!s || s.event_code !== eventSlug) {
        navigate(`/${eventSlug}/provider`, { replace: true });
        return;
      }
      setSession(s);
    };
    loadSession();
  }, [eventSlug, navigate]);

  const { data: services = [] } = useQuery({
    queryKey: ['provider-services', session?.provider_id],
    queryFn: () => providerPortalService.getServices(session!.provider_id),
    enabled: !!session?.provider_id,
  });
  const service = services.find((s) => s.id === serviceId);

  const attendeesKey = ['provider-attendees', session?.provider_id, serviceId];
  const { data: attendees = [], isLoading } = useQuery({
    queryKey: attendeesKey,
    queryFn: () => providerPortalService.getServiceAttendees(session!.provider_id, serviceId!),
    enabled: !!session?.provider_id && !!serviceId,
  });

  const validateMut = useMutation({
    mutationFn: (attendeeServiceId: string) =>
      providerPortalService.validateTicket(session!.provider_id, attendeeServiceId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('✅ ' + t('ticketValidated'));
        qc.invalidateQueries({ queryKey: attendeesKey });
      } else {
        toast.error(result.error ?? t('validationError'));
      }
    },
    onError: () => toast.error(t('validationError')),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return attendees;
    const q = search.toLowerCase();
    return attendees.filter((a) =>
      a.attendee_name.toLowerCase().includes(q) ||
      a.credential_code.toLowerCase().includes(q)
    );
  }, [attendees, search]);

  const handleExport = async () => {
    try {
      await writeExcelFile({
        filename: `${service?.name ?? 'service'}-attendees.xlsx`,
        sheetName: 'Attendees',
        columns: [
          { header: t('colName'), key: 'name', width: 30 },
          { header: t('colCredential'), key: 'credential', width: 20 },
          { header: t('colStatusHeader'), key: 'status', width: 15 },
          { header: t('colUsedAt'), key: 'used_at', width: 20 },
        ],
        rows: attendees.map((a) => ({
          name: a.attendee_name,
          credential: a.credential_code,
          status: a.is_used ? t('statusUsed') : t('statusPending'),
          used_at: a.used_at ?? '',
        })),
      });
      toast.success(t('exportSuccess'));
    } catch {
      toast.error(t('exportError'));
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/${eventSlug}/provider/dashboard`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{service?.name ?? '...'}</h1>
            <p className="text-xs text-muted-foreground">
              {attendees.length} {t('attendeesCount')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" /> {t('export')}
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('noAttendees')}
            </CardContent>
          </Card>
        ) : (
          filtered.map((a) => {
            const status = a.status ?? 'pending';
            const isUsed = a.is_used || status === 'completed';
            const isCancelled = status === 'cancelled';
            const statusBadge = (() => {
              if (isUsed) return <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">{t('statusUsed')}</Badge>;
              if (isCancelled) return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('statusCancelled')}</Badge>;
              if (status === 'in_progress') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{t('statusInProgress')}</Badge>;
              if (status === 'confirmed') return <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{t('statusConfirmed')}</Badge>;
              return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('statusPending')}</Badge>;
            })();
            return (
              <Card key={a.attendee_service_id} className={isCancelled ? 'opacity-60' : ''}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{a.attendee_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{a.credential_code}</p>
                    {a.used_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('usedAtLabel')}: {new Date(a.used_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge}
                    {!isUsed && !isCancelled && (
                      <Button
                        size="sm"
                        onClick={() => validateMut.mutate(a.attendee_service_id)}
                        disabled={validateMut.isPending}
                        className="bg-primary text-primary-foreground"
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        {t('markUsed')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
