import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesService } from '@/services/notes.service';

export function useNotes(eventId: string, attendeeId: string) {
  return useQuery({
    queryKey: ['notes', eventId, attendeeId],
    queryFn: () => notesService.getByEvent(eventId, attendeeId),
    enabled: !!eventId && !!attendeeId,
  });
}

export function useCreateNote(eventId: string, attendeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string | null; content: string }) =>
      notesService.create(eventId, attendeeId, sessionId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', eventId, attendeeId] });
    },
  });
}

export function useUpdateNote(eventId: string, attendeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, content, sessionId }: { noteId: string; content: string; sessionId: string | null }) =>
      notesService.update(noteId, content, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', eventId, attendeeId] });
    },
  });
}

export function useDeleteNote(eventId: string, attendeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => notesService.remove(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', eventId, attendeeId] });
    },
  });
}
