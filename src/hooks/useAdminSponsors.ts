import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSponsorsService, type SponsorFormData, type SponsorRow } from '@/services/admin-sponsors.service';

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
    onMutate: async (form) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<SponsorRow[]>(key);
      const optimistic: SponsorRow = {
        id: `optimistic-${Date.now()}`,
        event_id: eventId!,
        name: form.name,
        level: form.level,
        category: form.category,
        description: form.description ?? null,
        stand_location: form.stand_location ?? null,
        logo_url: null,
        website_url: form.website_url ?? null,
        materials_url: null,
        contact_email: form.contact_email ?? null,
        whatsapp: form.whatsapp ?? null,
        whatsapp_message: form.whatsapp_message ?? null,
        video_url: form.video_url ?? null,
        social_linkedin: form.social_linkedin ?? null,
        social_instagram: form.social_instagram ?? null,
        social_twitter: null,
        created_at: new Date().toISOString(),
        profile_views: 0,
        whatsapp_clicks: 0,
        website_clicks: 0,
        materials_downloads: 0,
      };
      qc.setQueryData<SponsorRow[]>(key, (old) => [optimistic, ...(old ?? [])]);
      return { previous, optimisticId: optimistic.id };
    },
    onError: (_err, _form, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (created, _form, ctx) => {
      qc.setQueryData<SponsorRow[]>(key, (old) =>
        (old ?? []).map((s) => (s.id === ctx?.optimisticId ? created : s))
      );
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: Parameters<typeof adminSponsorsService.update>[1] }) =>
      adminSponsorsService.update(id, form),
    onMutate: async ({ id, form }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<SponsorRow[]>(key);
      qc.setQueryData<SponsorRow[]>(key, (old) =>
        (old ?? []).map((s) => (s.id === id ? ({ ...s, ...form } as SponsorRow) : s)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (updated) => {
      if (updated) {
        qc.setQueryData<SponsorRow[]>(key, (old) =>
          (old ?? []).map((s) => (s.id === updated.id ? updated : s)),
        );
      }
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminSponsorsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    sponsors: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    createSponsor: createMutation.mutateAsync,
    updateSponsor: updateMutation.mutateAsync,
    deleteSponsor: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
