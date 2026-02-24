import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { adminLogisticsService, type ServiceAssignee, type ServiceCatalogRow } from '@/services/admin-logistics.service';

interface Props {
  open: boolean;
  onClose: () => void;
  service: ServiceCatalogRow | null;
}

export function ServiceAssigneesDrawer({ open, onClose, service }: Props) {
  const { t } = useTranslation('admin');
  const [assignees, setAssignees] = useState<ServiceAssignee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !service) return;
    setLoading(true);
    adminLogisticsService.getAssignees(service.id)
      .then(setAssignees)
      .finally(() => setLoading(false));
  }, [open, service]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('logistics.assigneesTitle')} — {service?.name}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-3">
            {t('logistics.assigneesCount', { count: assignees.length })}
          </p>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : assignees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('logistics.noAssignees')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('logistics.colAttendee')}</TableHead>
                  <TableHead>{t('logistics.colTicket')}</TableHead>
                  <TableHead>{t('logistics.colStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignees.map((a) => (
                  <TableRow key={a.attendee_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{a.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.specialty ?? a.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {a.ticket_code ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.is_used ? 'secondary' : 'default'} className={
                        a.is_used
                          ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                          : 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
                      }>
                        {a.is_used ? t('logistics.statusUsed') : t('logistics.statusPending')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
