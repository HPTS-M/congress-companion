import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';

export function useDocuments(eventId: string) {
  return useQuery({
    queryKey: ['documents', eventId],
    queryFn: () => documentsService.getByEvent(eventId),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });
}
