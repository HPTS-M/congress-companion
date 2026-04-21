import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useEvent } from '@/hooks/useEvent';
import { useAdminProviders } from '@/hooks/useAdminProviders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Search, Pencil, Trash2, Link2, Mail, RefreshCw, Activity,
  Bus, UtensilsCrossed, Map, Sparkles,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ProviderModal } from '@/components/admin/providers/ProviderModal';
import { AssignServicesModal } from '@/components/admin/providers/AssignServicesModal';
import { ProviderActivityDrawer } from '@/components/admin/providers/ProviderActivityDrawer';
import { adminProvidersService } from '@/services/admin-providers.service';
import type { ProviderRow, ProviderForm } from '@/services/admin-providers.service';
import { usePagination } from '@/hooks/usePagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { FilterChips, type FilterChipOption } from '@/components/ui/filter-chips';
import { Label } from '@/components/ui/label';

const TYPE_ICONS: Record<string, React.ElementType> = {
  transport: Bus, food: UtensilsCrossed, tour: Map, special: Sparkles,
};
const TYPE_COLORS: Record<string, string> = {
  transport: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  food: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  tour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  special: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

function getInvitationStatus(p: ProviderRow): 'none' | 'pending' | 'active' | 'expired' {
  if (!p.user_id) return 'none';
  if (p.access_expires_at && new Date(p.access_expires_at) < new Date()) return 'expired';
  if (p.last_login) return 'active';
  return 'pending';
}

function InvitationBadge({ status }: { status: ReturnType<typeof getInvitationStatus> }) {
  const { t } = useTranslation('admin');
  switch (status) {
    case 'active':
      return <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{t('providers.inviteActive')}</Badge>;
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('providers.invitePending')}</Badge>;
    case 'expired':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('providers.inviteExpired')}</Badge>;
    default:
      return <span className="text-xs text-muted-foreground">—</span>;
  }
}

export default function AdminProviders() {
  const { t } = useTranslation('admin');
  const { eventSlug } = useParams();
  const { event } = useEvent();
  const { providers, isLoading, createProvider, updateProvider, deleteProvider, toggleProvider, isCreating, isUpdating, refetch } = useAdminProviders(event?.id);

  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [onlyActive, setOnlyActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [assigning, setAssigning] = useState<ProviderRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  // Confirmation dialog states
  const [resendConfirm, setResendConfirm] = useState<ProviderRow | null>(null);
  const [emailChangedConfirm, setEmailChangedConfirm] = useState<{ provider: ProviderRow; newEmail: string } | null>(null);
  const [activityProvider, setActivityProvider] = useState<ProviderRow | null>(null);

  // Filtered by search only — for type counters
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return providers;
    const q = search.toLowerCase();
    return providers.filter((p) =>
      p.company_name.toLowerCase().includes(q) ||
      (p.contact_name ?? '').toLowerCase().includes(q) ||
      (p.contact_email ?? '').toLowerCase().includes(q)
    );
  }, [providers, search]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of searchFiltered) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  }, [searchFiltered]);

  const filtered = useMemo(() => {
    let list = searchFiltered;
    if (selectedTypes.length > 0) {
      list = list.filter((p) => selectedTypes.includes(p.category));
    }
    if (onlyActive) {
      list = list.filter((p) => p.is_active ?? true);
    }
    return list;
  }, [searchFiltered, selectedTypes, onlyActive]);

  const typeChipOptions = useMemo<FilterChipOption[]>(() => {
    const TYPES = ['transport', 'food', 'tour', 'special'] as const;
    return TYPES.filter((tp) => (typeCounts[tp] ?? 0) > 0).map((tp) => ({
      value: tp,
      label: t(`logistics.type${tp.charAt(0).toUpperCase() + tp.slice(1)}`),
      icon: TYPE_ICONS[tp],
      count: typeCounts[tp],
    }));
  }, [typeCounts, t]);

  const pagination = usePagination(filtered, 10);

  const handleSave = useCallback(async (data: ProviderForm) => {
    try {
      if (editing) {
        const oldEmail = editing.contact_email;
        const newEmail = data.contact_email;
        const emailChanged = oldEmail && newEmail && oldEmail !== newEmail && editing.user_id;

        await updateProvider({ id: editing.id, form: data });
        toast.success(t('providers.editSuccess'));

        // If email changed and invitation was already sent, prompt to reinvite
        if (emailChanged && newEmail) {
          setEmailChangedConfirm({ provider: editing, newEmail });
        }
      } else {
        await createProvider(data);
        toast.success(t('providers.createSuccess'));
      }
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_EMAIL') {
        toast.error(t('providers.duplicateEmail'));
      } else {
        toast.error(t('providers.saveError'));
      }
      throw err;
    }
  }, [editing, createProvider, updateProvider, t]);

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    try {
      await deleteProvider(deletingId);
      toast.success(t('providers.deleteSuccess'));
    } catch {
      toast.error(t('providers.deleteError'));
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, deleteProvider, t]);

  const handleToggle = useCallback(async (id: string, active: boolean) => {
    try {
      await toggleProvider({ id, active });
    } catch {
      toast.error(t('providers.saveError'));
    }
  }, [toggleProvider, t]);

  const handleEdit = useCallback((p: ProviderRow) => {
    setEditing(p);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const handleInvite = useCallback(async (p: ProviderRow) => {
    if (!p.contact_email || !event || !eventSlug) {
      toast.error(t('providers.emailRequired'));
      return;
    }
    setInvitingId(p.id);
    try {
      const { action } = await adminProvidersService.inviteProvider(p.id, p.contact_email, event.id, eventSlug);
      if (action === 'linked_existing') {
        toast.success(t('providers.accountLinked', { email: p.contact_email }));
      } else {
        toast.success(t('providers.inviteSent', { email: p.contact_email }));
      }
      refetch();
    } catch (err: any) {
      toast.error(t('providers.inviteError') + ': ' + (err.message ?? ''));
    } finally {
      setInvitingId(null);
    }
  }, [event, eventSlug, t, refetch]);

  // Resend: show confirmation first
  const handleResendClick = useCallback((p: ProviderRow) => {
    setResendConfirm(p);
  }, []);

  const handleResendConfirmed = useCallback(async () => {
    const p = resendConfirm;
    if (!p?.contact_email || !event || !eventSlug) return;
    setResendConfirm(null);
    setInvitingId(p.id);
    try {
      await adminProvidersService.resendInvite(p.id, p.contact_email, event.id, eventSlug);
      toast.success(t('providers.inviteResent', { email: p.contact_email }));
      refetch();
    } catch (err: any) {
      toast.error(t('providers.inviteError') + ': ' + (err.message ?? ''));
    } finally {
      setInvitingId(null);
    }
  }, [resendConfirm, event, eventSlug, t, refetch]);

  // Email changed: reinvite with new email (delete old user + new invite)
  const handleEmailChangedReinvite = useCallback(async () => {
    if (!emailChangedConfirm || !event || !eventSlug) return;
    const { provider, newEmail } = emailChangedConfirm;
    setEmailChangedConfirm(null);
    setInvitingId(provider.id);
    try {
      await adminProvidersService.reinviteProvider(provider.id, newEmail, event.id, eventSlug);
      toast.success(t('providers.reinviteSent', { email: newEmail }));
      refetch();
    } catch (err: any) {
      toast.error(t('providers.inviteError') + ': ' + (err.message ?? ''));
    } finally {
      setInvitingId(null);
    }
  }, [emailChangedConfirm, event, eventSlug, t, refetch]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('providers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('providers.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-primary text-primary-foreground">
          <Plus className="mr-1 h-4 w-4" /> {t('providers.newProvider')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('providers.searchPlaceholder')} className="pl-9" />
      </div>

      {/* Filter chips: type + onlyActive */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <FilterChips
            ariaLabel={t('providers.filters.allTypes')}
            allLabel={t('providers.filters.allTypes')}
            allCount={searchFiltered.length}
            selected={selectedTypes}
            onChange={setSelectedTypes}
            options={typeChipOptions}
          />
        </div>
        <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer select-none">
          <Switch checked={onlyActive} onCheckedChange={setOnlyActive} />
          <Label className="text-sm text-muted-foreground cursor-pointer">
            {t('providers.filters.onlyActive')}
          </Label>
        </label>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('providers.colCompany')}</TableHead>
              <TableHead>{t('providers.colCategory')}</TableHead>
              <TableHead>{t('providers.colContact')}</TableHead>
              <TableHead>{t('providers.colServices')}</TableHead>
              <TableHead>{t('providers.colInvitation')}</TableHead>
              <TableHead>{t('providers.colLastLogin')}</TableHead>
              <TableHead>{t('providers.colStatus')}</TableHead>
              <TableHead className="text-right">{t('providers.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t('providers.noProviders')}
                </TableCell>
              </TableRow>
            ) : pagination.paginatedItems.map((p) => {
              const Icon = TYPE_ICONS[p.category] ?? Bus;
              const invStatus = getInvitationStatus(p);
              const isPendingLong = invStatus === 'pending' && p.user_id && !p.last_login;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[p.category]?.split(' ').slice(0, 1).join(' ') ?? 'bg-muted'} ${TYPE_COLORS[p.category]?.split(' ').slice(1, 2).join(' ') ?? 'text-muted-foreground'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{p.company_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.access_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_COLORS[p.category] ?? ''}>
                      {t(`logistics.type${p.category.charAt(0).toUpperCase() + p.category.slice(1)}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.contact_name && <p className="text-sm text-foreground">{p.contact_name}</p>}
                    {p.contact_email && <p className="text-xs text-muted-foreground">{p.contact_email}</p>}
                    {p.contact_phone && <p className="text-xs text-muted-foreground">{p.contact_phone}</p>}
                    {!p.contact_name && !p.contact_email && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-foreground">{p.assigned_services}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <InvitationBadge status={invStatus} />
                      {(isPendingLong || invStatus === 'expired') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleResendClick(p)}
                          disabled={invitingId === p.id}
                          title={t('providers.resendInvite')}
                        >
                          <RefreshCw className={`h-3 w-3 ${invitingId === p.id ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.last_login ? (
                      <div>
                        <p className="text-xs text-foreground">{new Date(p.last_login).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">{t('providers.loginCount', { count: p.login_count })}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('providers.neverLoggedIn')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.is_active ?? true}
                      onCheckedChange={(checked) => handleToggle(p.id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {!p.user_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleInvite(p)}
                          disabled={invitingId === p.id}
                          title={t('providers.sendInvite')}
                          className="text-primary"
                        >
                          <Mail className={`h-4 w-4 ${invitingId === p.id ? 'animate-pulse' : ''}`} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setActivityProvider(p)} title={t('providers.viewActivity')}>
                        <Activity className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setAssigning(p)} title={t('providers.assignServices')}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} title={t('sponsors.edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletingId(p.id)} className="text-destructive hover:text-destructive" title={t('sponsors.delete')}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

      {/* Provider Modal */}
      {modalOpen && (
        <ProviderModal
          open={modalOpen}
          onClose={handleCloseModal}
          onSave={handleSave}
          provider={editing}
          isSaving={isCreating || isUpdating}
        />
      )}

      {/* Assign Services Modal */}
      {assigning && event && (
        <AssignServicesModal
          open={!!assigning}
          onClose={() => setAssigning(null)}
          provider={assigning}
          eventId={event.id}
          onSaved={() => {}}
        />
      )}

      {/* Activity drawer */}
      <ProviderActivityDrawer
        open={!!activityProvider}
        onClose={() => setActivityProvider(null)}
        provider={activityProvider}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('providers.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('providers.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sponsors.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t('sponsors.deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resend invitation confirm */}
      <AlertDialog open={!!resendConfirm} onOpenChange={(o) => !o && setResendConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('providers.resendConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('providers.resendConfirm', { email: resendConfirm?.contact_email ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sponsors.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResendConfirmed} className="bg-primary text-primary-foreground">
              {t('providers.resendInvite')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email changed — reinvite confirm */}
      <AlertDialog open={!!emailChangedConfirm} onOpenChange={(o) => !o && setEmailChangedConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('providers.emailChangedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('providers.emailChangedMessage', { email: emailChangedConfirm?.newEmail ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('providers.emailChangedNo')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmailChangedReinvite} className="bg-primary text-primary-foreground">
              {t('providers.emailChangedYes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
