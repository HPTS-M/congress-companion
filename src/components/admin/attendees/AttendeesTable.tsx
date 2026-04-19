import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Pencil, Trash2, Copy, RefreshCw, Ban, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useEvent } from '@/hooks/useEvent';
import type { AttendeeWithServices } from '@/services/admin-attendees.service';

interface Props {
  attendees: AttendeeWithServices[];
  isLoading: boolean;
  isRefetching?: boolean;
  onView: (id: string) => void;
  onEdit: (attendee: AttendeeWithServices) => void;
  onDelete: (id: string, name: string) => void;
  onToggleActive: (attendee: AttendeeWithServices) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function StatusBadgeInner({ status }: { status: string | null }) {
  const { t } = useTranslation('admin');
  const s = status ?? 'pending';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        s === 'confirmed' && 'bg-accent/15 text-accent',
        s === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
        s === 'cancelled' && 'bg-destructive/15 text-destructive',
      )}
    >
      {s === 'cancelled' && <Ban className="h-3 w-3" />}
      {t(`attendees.status${s.charAt(0).toUpperCase() + s.slice(1)}` as any)}
    </span>
  );
}
const StatusBadge = memo(StatusBadgeInner);

interface RowProps {
  a: AttendeeWithServices;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onView: (id: string) => void;
  onEdit: (a: AttendeeWithServices) => void;
  onDelete: (id: string, name: string) => void;
  onToggleActive: (a: AttendeeWithServices) => void;
  externalCredentialsEnabled: boolean;
}

const AttendeeRow = memo(function AttendeeRow({
  a, selected, onToggleSelect, onView, onEdit, onDelete, onToggleActive, externalCredentialsEnabled,
}: RowProps) {
  const { t } = useTranslation('admin');
  const isCancelled = a.registration_status === 'cancelled';

  const displayedCode = externalCredentialsEnabled
    ? ((a as AttendeeWithServices & { external_credential_code?: string | null }).external_credential_code || a.credential_code)
    : a.credential_code;

  const copyCode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(displayedCode);
    toast({ title: t('attendees.codeCopied'), duration: 1500 });
  }, [displayedCode, t]);

  return (
    <TableRow className={cn('cursor-pointer', isCancelled && 'opacity-60')} onClick={() => onView(a.id)}>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(a.id)} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {getInitials(a.full_name)}
          </div>
          <div>
            <div className="font-medium text-foreground">{a.full_name}</div>
            {a.specialty && <div className="text-xs text-muted-foreground">{a.specialty}</div>}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          title={t('attendees.codeCopied')}
        >
          {displayedCode}
          <Copy className="h-3 w-3" />
        </button>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
      <TableCell><StatusBadge status={a.registration_status} /></TableCell>
      <TableCell className="text-center">
        <Badge variant="secondary" className="text-xs">{a.servicesCount}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => onView(a.id)} title={t('attendees.view')}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(a)} title={t('attendees.edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={isCancelled ? 'text-accent hover:text-accent' : 'text-amber-600 hover:text-amber-700'}
            onClick={() => onToggleActive(a)}
            title={isCancelled ? t('attendees.reactivate') : t('attendees.deactivate')}
          >
            {isCancelled ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(a.id, a.full_name)}
            title={t('attendees.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export function AttendeesTable({
  attendees, isLoading, isRefetching, onView, onEdit, onDelete, onToggleActive, selectedIds, onSelectionChange,
}: Props) {
  const { t } = useTranslation('admin');

  const toggleSelect = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === attendees.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(attendees.map((a) => a.id)));
    }
  }, [selectedIds.size, attendees, onSelectionChange]);

  const allSelected = attendees.length > 0 && selectedIds.size === attendees.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < attendees.length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p>{t('attendees.noResults')}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isRefetching && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/40 backdrop-blur-[1px] animate-fade-in">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <div className={cn('transition-opacity', isRefetching && 'opacity-60')}>
        {/* Desktop table */}
        <div className="hidden md:block rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) (el as any).indeterminate = someSelected;
                    }}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>{t('attendees.columnName')}</TableHead>
                <TableHead>{t('attendees.columnCode')}</TableHead>
                <TableHead>{t('attendees.columnEmail')}</TableHead>
                <TableHead>{t('attendees.columnStatus')}</TableHead>
                <TableHead className="text-center">{t('attendees.columnServices')}</TableHead>
                <TableHead className="text-right">{t('attendees.columnActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendees.map((a) => (
                <AttendeeRow
                  key={a.id}
                  a={a}
                  selected={selectedIds.has(a.id)}
                  onToggleSelect={toggleSelect}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleActive={onToggleActive}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile list */}
        <div className="space-y-2 md:hidden">
          {attendees.map((a) => {
            const isCancelled = a.registration_status === 'cancelled';
            return (
              <div
                key={a.id}
                className={cn('flex items-center gap-3 rounded-lg border bg-card p-3 cursor-pointer', isCancelled && 'opacity-60')}
                onClick={() => onView(a.id)}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(a.id)}
                    onCheckedChange={() => toggleSelect(a.id)}
                  />
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {getInitials(a.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{a.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={a.registration_status} />
                    <span className="font-mono text-[10px] text-muted-foreground">{a.credential_code}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7', isCancelled ? 'text-accent' : 'text-amber-600')}
                    onClick={() => onToggleActive(a)}
                    title={isCancelled ? t('attendees.reactivate') : t('attendees.deactivate')}
                  >
                    {isCancelled ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => onDelete(a.id, a.full_name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
