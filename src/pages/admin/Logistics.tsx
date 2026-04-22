import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useEvent } from '@/hooks/useEvent';
import { useAdminLogistics } from '@/hooks/useAdminLogistics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Search, Pencil, Trash2, Users, Ticket, Clock, CheckCircle2, XCircle,
  Bus, UtensilsCrossed, Map, Sparkles, Ban, RotateCcw, Settings,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ServiceModal } from '@/components/admin/logistics/ServiceModal';
import { ServiceAssigneesDrawer } from '@/components/admin/logistics/ServiceAssigneesDrawer';
import type { ServiceCatalogRow, ServiceCatalogForm } from '@/services/admin-logistics.service';
import { usePagination } from '@/hooks/usePagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const TYPE_ICONS: Record<string, React.ElementType> = {
  transport: Bus,
  food: UtensilsCrossed,
  tour: Map,
  special: Sparkles,
};

const TYPE_COLORS: Record<string, string> = {
  transport: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  food: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  tour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  special: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const ICON_BG: Record<string, string> = {
  transport: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  food: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  tour: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  special: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
};

export default function AdminLogistics() {
  const { t } = useTranslation('admin');
  const { eventSlug } = useParams();
  const navigate = useNavigate();
  const { event } = useEvent();
  const { services, isLoading, createService, updateService, deleteService, cancelService, reactivateService, isCreating, isUpdating } = useAdminLogistics(event?.id);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCatalogRow | null>(null);
  const [viewingAssignees, setViewingAssignees] = useState<ServiceCatalogRow | null>(null);
  const [deleting, setDeleting] = useState<ServiceCatalogRow | null>(null);
  const [cancellingId, setCancellingId] = useState<ServiceCatalogRow | null>(null);

  const stats = useMemo(() => {
    let total = 0, pending = 0, used = 0, cancelled = 0;
    for (const s of services) {
      total += s.total_tickets;
      used += s.used_tickets;
      cancelled += s.cancelled_tickets;
      pending += s.total_tickets - s.used_tickets - s.cancelled_tickets;
    }
    return { total, pending, used, cancelled };
  }, [services]);

  const filtered = useMemo(() => {
    let list = services;
    if (tab !== 'all') {
      list = list.filter((s) => s.service_type === tab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.location ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [services, tab, search]);

  const pagination = usePagination(filtered, 10);

  const handleSave = useCallback(async (data: ServiceCatalogForm) => {
    try {
      if (editing) {
        await updateService({ id: editing.id, form: data });
        toast.success(t('logistics.editSuccess'));
      } else {
        await createService(data);
        toast.success(t('logistics.createSuccess'));
      }
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_NAME') {
        toast.error(t('logistics.duplicateName'));
      } else {
        toast.error(t('logistics.saveError'));
      }
      throw err;
    }
  }, [editing, createService, updateService, t]);

  const handleDelete = useCallback(async () => {
    if (!deleting) return;
    try {
      await deleteService(deleting.id);
      toast.success(t('logistics.deleteSuccess'));
    } catch (err: any) {
      if (err?.message === 'SERVICE_HAS_DEPENDENCIES') {
        toast.error(t('logistics.deleteHasDependenciesError'));
      } else {
        toast.error(t('logistics.deleteError'));
      }
    } finally {
      setDeleting(null);
    }
  }, [deleting, deleteService, t]);

  const handleCancelService = useCallback(async () => {
    if (!cancellingId) return;
    try {
      await cancelService(cancellingId.id);
      toast.success(t('logistics.cancelSuccess'));
    } catch {
      toast.error(t('logistics.cancelError'));
    } finally {
      setCancellingId(null);
    }
  }, [cancellingId, cancelService, t]);

  const handleReactivate = useCallback(async (s: ServiceCatalogRow) => {
    try {
      await reactivateService(s.id);
      toast.success(t('logistics.reactivateSuccess'));
    } catch {
      toast.error(t('logistics.saveError'));
    }
  }, [reactivateService, t]);

  const handleEdit = useCallback((s: ServiceCatalogRow) => {
    setEditing(s);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('logistics.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('logistics.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-primary text-primary-foreground">
          <Plus className="mr-1 h-4 w-4" /> {t('logistics.newService')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <Ticket className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">{t('logistics.statTotal')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Clock className="mx-auto h-5 w-5 text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">{t('logistics.statPending')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500 mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.used}</p>
          <p className="text-xs text-muted-foreground">{t('logistics.statUsed')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <XCircle className="mx-auto h-5 w-5 text-destructive mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.cancelled}</p>
          <p className="text-xs text-muted-foreground">{t('logistics.statCancelled')}</p>
        </CardContent></Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">{t('logistics.filterAll')}</TabsTrigger>
            <TabsTrigger value="transport">{t('logistics.typeTransport')}</TabsTrigger>
            <TabsTrigger value="food">{t('logistics.typeFood')}</TabsTrigger>
            <TabsTrigger value="tour">{t('logistics.typeTour')}</TabsTrigger>
            <TabsTrigger value="special">{t('logistics.typeSpecial')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('logistics.searchPlaceholder')} className="pl-9" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('logistics.colService')}</TableHead>
              <TableHead>{t('logistics.colCategory')}</TableHead>
              <TableHead>{t('logistics.colSchedule')}</TableHead>
              <TableHead>{t('logistics.colServiceStatus')}</TableHead>
              <TableHead>{t('logistics.colTickets')}</TableHead>
              <TableHead className="text-right">{t('logistics.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('logistics.noServices')}
                </TableCell>
              </TableRow>
            ) : pagination.paginatedItems.map((s) => {
              const Icon = TYPE_ICONS[s.service_type] ?? Ticket;
              const pendingCount = s.total_tickets - s.used_tickets - s.cancelled_tickets;
              const eff = s.effective_status ?? 'scheduled';
              const isCancelled = eff === 'cancelled';
              const isCompleted = eff === 'completed';
              return (
                <TableRow key={s.id} className={isCancelled ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${ICON_BG[s.service_type] ?? 'bg-muted text-muted-foreground'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{s.name}</p>
                        {s.location && <p className="text-xs text-muted-foreground">{s.location}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_COLORS[s.service_type] ?? ''}>
                      {t(`logistics.type${capitalize(s.service_type)}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.starts_at || s.ends_at ? (
                      <div className="flex flex-col gap-0.5">
                        {s.starts_at && (
                          <span>
                            <span className="text-xs font-medium text-muted-foreground/70">{t('logistics.startLabel', { defaultValue: 'Inicio' })}: </span>
                            {formatDateTime(s.starts_at)}
                          </span>
                        )}
                        {s.ends_at && (
                          <span>
                            <span className="text-xs font-medium text-muted-foreground/70">{t('logistics.endLabel', { defaultValue: 'Fin' })}: </span>
                            {formatDateTime(s.ends_at)}
                          </span>
                        )}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider delayDuration={150}>
                      {isCancelled ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 w-fit cursor-help">
                              {t('logistics.serviceStatusCancelled')}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('logistics.statusTooltipCancelled', { defaultValue: 'Servicio cancelado' })}
                          </TooltipContent>
                        </Tooltip>
                      ) : isCompleted ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 w-fit cursor-help">
                              {t('logistics.serviceStatusCompleted')}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {s.ends_at
                              ? t('logistics.statusTooltipCompleted', { date: formatDateTime(s.ends_at), defaultValue: 'Finalizado el {{date}}' })
                              : t('logistics.serviceStatusCompleted')}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 cursor-help">
                              {t('logistics.serviceStatusScheduled')}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {s.starts_at
                              ? t('logistics.statusTooltipScheduled', { date: formatDateTime(s.starts_at), defaultValue: 'Programado para {{date}}' })
                              : t('logistics.serviceStatusScheduled')}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-foreground">
                      {s.used_tickets}/{s.total_tickets}
                    </span>
                    {pendingCount > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({pendingCount} {t('logistics.pendingLabel')})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={t('logistics.actionsMenu', { defaultValue: 'Acciones del servicio' })}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => navigate(`/${eventSlug}/admin/logistics/${s.id}/assign`)}>
                            <Users className="mr-2 h-4 w-4" />
                            {t('logistics.viewAssignees')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(s)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('sponsors.edit')}
                          </DropdownMenuItem>
                          {isCancelled ? (
                            <DropdownMenuItem onClick={() => handleReactivate(s)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              {t('logistics.reactivateService')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setCancellingId(s)} className="text-amber-600 focus:text-amber-600">
                              <Ban className="mr-2 h-4 w-4" />
                              {t('logistics.cancelService')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleting(s)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('sponsors.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        onPageChange={pagination.setPage}
      />

      {/* Modal */}
      {modalOpen && (
        <ServiceModal
          open={modalOpen}
          onClose={handleCloseModal}
          onSave={handleSave}
          service={editing}
          isSaving={isCreating || isUpdating}
        />
      )}

      {/* Assignees drawer */}
      <ServiceAssigneesDrawer
        open={!!viewingAssignees}
        onClose={() => setViewingAssignees(null)}
        service={viewingAssignees}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logistics.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.total_tickets > 0
                ? t('logistics.deleteConfirmWithAssignees', { count: deleting.total_tickets })
                : t('logistics.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sponsors.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t('sponsors.deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel service confirm */}
      <AlertDialog open={!!cancellingId} onOpenChange={(o) => !o && setCancellingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logistics.cancelServiceTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('logistics.cancelServiceConfirm', { name: cancellingId?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sponsors.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelService} className="bg-amber-600 text-white hover:bg-amber-700">
              {t('logistics.cancelService')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
