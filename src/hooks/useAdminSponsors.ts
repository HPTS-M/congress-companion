import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSponsorsService, type SponsorFormData } from '@/services/admin-sponsors.service';

export function useAdminSponsors(eventId: string | undefined) {
  const qc = useQueryClient();
  const key = ['admin-sponsors', eventId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => adminSponsorsService.getAll(eventId!),
    enabled: !!eventId,
  });

  const createMutation = useMutation({
    mutationFn: (form: SponsorFormData) => adminSponsorsService.create(eventId!, form),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: Parameters<typeof adminSponsorsService.update>[1] }) =>
      adminSponsorsService.update(id, form),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminSponsorsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    sponsors: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createSponsor: createMutation.mutateAsync,
    updateSponsor: updateMutation.mutateAsync,
    deleteSponsor: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
