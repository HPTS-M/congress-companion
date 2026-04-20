import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function useDocuments(eventId: string) {
  const isOnline = useOnlineStatus();

  useRealtimeInvalidate({
    channelName: `documents-${eventId}`,
    table: 'documents',
    filter: eventId ? `event_id=eq.${eventId}` : undefined,
    queryKeys: [['documents', eventId]],
    enabled: !!eventId && isOnline,
  });

  return useQuery({
    queryKey: ['documents', eventId],
    queryFn: () => documentsService.getByEvent(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
  });
}
