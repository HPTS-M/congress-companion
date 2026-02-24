import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProvidersService, type ProviderForm } from '@/services/admin-providers.service';

export function useAdminProviders(eventId: string | undefined) {
  const qc = useQueryClient();
  const key = ['admin-providers', eventId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => adminProvidersService.getAll(eventId!),
    enabled: !!eventId,
  });

  const createMutation = useMutation({
    mutationFn: (form: ProviderForm) => adminProvidersService.create(eventId!, form),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: Partial<ProviderForm> }) =>
      adminProvidersService.update(id, form),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminProvidersService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminProvidersService.toggleActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    providers: query.data ?? [],
    isLoading: query.isLoading,
    createProvider: createMutation.mutateAsync,
    updateProvider: updateMutation.mutateAsync,
    deleteProvider: deleteMutation.mutateAsync,
    toggleProvider: toggleMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
