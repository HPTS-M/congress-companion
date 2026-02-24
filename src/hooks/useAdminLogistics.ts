import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminLogisticsService, type ServiceCatalogForm } from '@/services/admin-logistics.service';

export function useAdminLogistics(eventId: string | undefined) {
  const qc = useQueryClient();
  const key = ['admin-logistics', eventId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => adminLogisticsService.getAll(eventId!),
    enabled: !!eventId,
  });

  const createMutation = useMutation({
    mutationFn: (form: ServiceCatalogForm) => adminLogisticsService.create(eventId!, form),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: Partial<ServiceCatalogForm> }) =>
      adminLogisticsService.update(id, form),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminLogisticsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    services: query.data ?? [],
    isLoading: query.isLoading,
    createService: createMutation.mutateAsync,
    updateService: updateMutation.mutateAsync,
    deleteService: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
