import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AttendeeWithServices } from '@/services/admin-attendees.service';
import { Copy, Eye, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  attendees: AttendeeWithServices[];
  isLoading: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function StatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation('admin');
  const s = status ?? 'pending';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        s === 'confirmed' && 'bg-accent/15 text-accent',
        s === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
        s === 'cancelled' && 'bg-destructive/15 text-destructive',
      )}
    >
      {t(`attendees.status${s.charAt(0).toUpperCase() + s.slice(1)}` as any)}
    </span>
  );
}

export function AttendeesTable({ attendees, isLoading, onView, onEdit, onDelete }: Props) {
  const { t } = useTranslation('admin');

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: t('attendees.codeCopied'), duration: 1500 });
  };

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
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow key={a.id} className="cursor-pointer" onClick={() => onView(a.id)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(a.full_name)}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{a.full_name}</div>
                      {a.specialty && (
                        <div className="text-xs text-muted-foreground">{a.specialty}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCode(a.credential_code); }}
                    className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                    title={t('attendees.codeCopied')}
                  >
                    {a.credential_code}
                    <Copy className="h-3 w-3" />
                  </button>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                <TableCell>
                  <StatusBadge status={a.registration_status} />
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="text-xs">{a.servicesCount}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => onView(a.id)} title={t('attendees.view')}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(a.id)} title={t('attendees.edit')}>
                      <Pencil className="h-4 w-4" />
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
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile list */}
      <div className="space-y-2 md:hidden">
        {attendees.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-lg border bg-card p-3 cursor-pointer"
            onClick={() => onView(a.id)}
          >
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
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(a.id, a.full_name); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
