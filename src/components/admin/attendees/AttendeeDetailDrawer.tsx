import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, RefreshCw, Mail } from 'lucide-react';
import { format } from 'date-fns';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useAttendeeDetail } from '@/hooks/useAdminAttendees';
import { adminAttendeesService } from '@/services/admin-attendees.service';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Props {
  attendeeId: string | null;
  onClose: () => void;
}

export function AttendeeDetailDrawer({ attendeeId, onClose }: Props) {
  const { t } = useTranslation('admin');
  const { data, isLoading } = useAttendeeDetail(attendeeId);
  const queryClient = useQueryClient();

  const handleRegenerate = async () => {
    if (!attendeeId) return;
    if (!window.confirm(t('attendees.detail.regenerateConfirm'))) return;
    try {
      await adminAttendeesService.regenerateCode(attendeeId);
      queryClient.invalidateQueries({ queryKey: ['admin-attendee-detail', attendeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendees'] });
      toast({ title: t('attendees.detail.regenerateSuccess') });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={!!attendeeId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-auto">
        <SheetHeader>
          <SheetTitle>{t('attendees.detail.title')}</SheetTitle>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Profile */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('attendees.detail.profile')}</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {data.attendee.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{data.attendee.full_name}</div>
                  <div className="text-sm text-muted-foreground">{data.attendee.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {data.attendee.specialty && (
                  <div>
                    <span className="text-muted-foreground">{t('attendees.detail.specialty')}:</span>
                    <span className="ml-1 text-foreground">{data.attendee.specialty}</span>
                  </div>
                )}
                {data.attendee.institution && (
                  <div>
                    <span className="text-muted-foreground">{t('attendees.detail.institution')}:</span>
                    <span className="ml-1 text-foreground">{data.attendee.institution}</span>
                  </div>
                )}
                {data.attendee.phone && (
                  <div>
                    <span className="text-muted-foreground">{t('attendees.detail.phone')}:</span>
                    <span className="ml-1 text-foreground">{data.attendee.phone}</span>
                  </div>
                )}
                {data.attendee.registration_date && (
                  <div>
                    <span className="text-muted-foreground">{t('attendees.detail.registrationDate')}:</span>
                    <span className="ml-1 text-foreground">
                      {format(new Date(data.attendee.registration_date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
              </div>
              <Badge
                className={cn(
                  'text-xs',
                  data.attendee.registration_status === 'confirmed' && 'bg-accent/15 text-accent border-accent/30',
                  data.attendee.registration_status === 'pending' && 'bg-secondary text-muted-foreground border-border',
                  data.attendee.registration_status === 'cancelled' && 'bg-destructive/15 text-destructive border-destructive/30',
                )}
                variant="outline"
              >
                {data.attendee.registration_status}
              </Badge>
            </div>

            <Separator />

            {/* Credential + QR */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('attendees.detail.credentialCode')}</h3>
              <div className="font-mono text-lg text-primary font-bold text-center">
                {data.attendee.credential_code}
              </div>
              <div className="flex justify-center">
                <QRCodeSVG value={data.attendee.credential_code} size={120} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleRegenerate}>
                  <RefreshCw className="mr-2 h-3 w-3" />
                  {t('attendees.detail.regenerateCode')}
                </Button>
                <Button variant="outline" size="sm" className="flex-1" disabled>
                  <Mail className="mr-2 h-3 w-3" />
                  {t('attendees.detail.sendByEmail')}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Services */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('attendees.detail.services')}</h3>
              {data.services.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('attendees.detail.noServices')}</p>
              ) : (
                <div className="space-y-2">
                  {data.services.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="text-foreground">{(s.service_catalog as any)?.name ?? s.service_catalog_id}</span>
                      <Badge variant="secondary" className="text-xs">{s.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Check-ins */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('attendees.detail.checkins')}</h3>
              {data.checkins.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('attendees.detail.noCheckins')}</p>
              ) : (
                <div className="space-y-2">
                  {data.checkins.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-foreground">{(c.event_activities as any)?.title ?? c.activity_id}</span>
                      </div>
                      {c.checked_in_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.checked_in_at), 'dd/MM HH:mm')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
