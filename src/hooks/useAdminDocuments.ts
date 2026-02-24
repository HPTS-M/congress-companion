import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminDocumentsService, type UpdateDocumentData, type CreateDocumentData } from '@/services/admin-documents.service';

export function useAdminDocuments(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-documents', eventId],
    queryFn: () => adminDocumentsService.getDocuments(eventId!),
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDocumentActivities(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-doc-activities', eventId],
    queryFn: () => adminDocumentsService.getActivities(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDocument(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentData) => adminDocumentsService.createDocument(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-documents', eventId] }),
  });
}

export function useUpdateDocument(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, updates }: { docId: string; updates: UpdateDocumentData }) =>
      adminDocumentsService.updateDocument(docId, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-documents', eventId] }),
  });
}

export function useDeleteDocument(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, filePath }: { docId: string; filePath: string }) =>
      adminDocumentsService.deleteDocument(docId, filePath),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-documents', eventId] }),
  });
}

export function useBulkDeleteDocuments(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docs: { id: string; file_path: string }[]) =>
      adminDocumentsService.bulkDelete(docs),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-documents', eventId] }),
  });
}
