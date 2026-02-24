import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Bus, UtensilsCrossed, Map, Sparkles } from 'lucide-react';
import { adminProvidersService, type ProviderRow } from '@/services/admin-providers.service';
import { adminLogisticsService } from '@/services/admin-logistics.service';
import { toast } from 'sonner';

const TYPE_ICONS: Record<string, React.ElementType> = {
  transport: Bus, food: UtensilsCrossed, tour: Map, special: Sparkles,
};

interface Props {
  open: boolean;
  onClose: () => void;
  provider: ProviderRow;
  eventId: string;
  onSaved: () => void;
}

export function AssignServicesModal({ open, onClose, provider, eventId, onSaved }: Props) {
  const { t } = useTranslation('admin');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['admin-logistics', eventId],
    queryFn: () => adminLogisticsService.getAll(eventId),
    enabled: !!eventId,
  });

  const { data: assignedIds, isLoading: loadingAssigned } = useQuery({
    queryKey: ['provider-assigned', provider.id],
    queryFn: () => adminProvidersService.getAssignedServiceIds(provider.id),
    enabled: !!provider.id,
  });

  useEffect(() => {
    if (assignedIds) {
      setSelected(new Set(assignedIds));
    }
  }, [assignedIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminProvidersService.setAssignedServices(provider.id, Array.from(selected));
      toast.success(t('providers.assignSuccess', { count: selected.size }));
      onSaved();
      onClose();
    } catch {
      toast.error(t('providers.assignError'));
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loadingServices || loadingAssigned;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('providers.assignTitle')} — {provider.company_name}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('logistics.noServices')}</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {services.map((s) => {
              const Icon = TYPE_ICONS[s.service_type] ?? Bus;
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                  />
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    {s.location && <p className="text-xs text-muted-foreground">{s.location}</p>}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {s.total_tickets} tickets
                  </Badge>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {t('providers.assignedCount', { count: selected.size })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{t('sponsors.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? t('sponsors.saving') : t('sponsors.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
