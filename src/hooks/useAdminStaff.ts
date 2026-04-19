import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminStaffService, type StaffMember } from '@/services/admin-staff.service';

export function useStaffMembers(eventId: string | undefined) {
  return useQuery({
    queryKey: ['staff-members', eventId],
    queryFn: () => adminStaffService.getStaffMembers(eventId!),
    enabled: !!eventId,
    staleTime: 60 * 1000,
  });
}

export function useCreateStaffMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (member: {
      event_id: string;
      full_name: string;
      contact_email: string;
      assigned_room?: string;
      access_expires_at?: string;
    }) => adminStaffService.createStaffMember(member),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-members', variables.event_id] });
    },
  });
}

export function useUpdateStaffMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<StaffMember> }) =>
      adminStaffService.updateStaffMember(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
    },
  });
}

export function useDeleteStaffMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminStaffService.deleteStaffMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
    },
  });
}

export function useInviteStaffUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      email: string;
      full_name: string;
      event_id: string;
      assigned_room?: string;
      access_expires_at?: string;
      action?: string;
    }) => adminStaffService.inviteStaffUser(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
    },
  });
}

export function useSetStaffInvitationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'active' }) =>
      adminStaffService.setInvitationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
    },
  });
}

export function useToggleStaffActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminStaffService.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
    },
  });
}
