import { supabase } from '@/integrations/supabase/client';
import type { DocumentRow, EventActivity } from '@/types';

export interface CreateDocumentData {
  event_id: string;
  title: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  session_id: string | null;
  description: string | null;
}

export interface UpdateDocumentData {
  title?: string;
  session_id?: string | null;
  description?: string | null;
}

export interface DocumentWithSession extends DocumentRow {
  session_title?: string | null;
}

export const adminDocumentsService = {
  getDocuments: async (eventId: string): Promise<DocumentWithSession[]> => {
    const { data, error } = await supabase
      .from('documents')
      .select('*, event_activities:session_id(title)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((d: Record<string, unknown>) => ({
      ...(d as unknown as DocumentRow),
      session_title: (d.event_activities as { title: string } | null)?.title ?? null,
    }));
  },

  createDocument: async (doc: CreateDocumentData): Promise<DocumentRow> => {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        event_id: doc.event_id,
        title: doc.title,
        file_path: doc.file_path,
        file_type: doc.file_type,
        file_size: doc.file_size,
        session_id: doc.session_id,
        description: doc.description,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as unknown as DocumentRow;
  },

  updateDocument: async (docId: string, updates: UpdateDocumentData): Promise<DocumentRow> => {
    const payload: Record<string, unknown> = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.session_id !== undefined) payload.session_id = updates.session_id || null;
    if (updates.description !== undefined) payload.description = updates.description || null;

    const { data, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', docId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as unknown as DocumentRow;
  },

  deleteDocument: async (docId: string, filePath: string): Promise<void> => {
    // Delete from storage first
    await supabase.storage.from('event-documents').remove([filePath]);
    const { error } = await supabase.from('documents').delete().eq('id', docId);
    if (error) throw new Error(error.message);
  },

  bulkDelete: async (docs: { id: string; file_path: string }[]): Promise<void> => {
    const paths = docs.map((d) => d.file_path);
    if (paths.length > 0) {
      await supabase.storage.from('event-documents').remove(paths);
    }
    const ids = docs.map((d) => d.id);
    const { error } = await supabase.from('documents').delete().in('id', ids);
    if (error) throw new Error(error.message);
  },

  uploadFile: async (eventId: string, file: File): Promise<{ path: string; size: number }> => {
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const path = `${eventId}/${safeName}`;

    const { error } = await supabase.storage
      .from('event-documents')
      .upload(path, file, { upsert: false });

    if (error) throw new Error(error.message);
    return { path, size: file.size };
  },

  replaceFile: async (eventId: string, oldPath: string, file: File): Promise<{ path: string; size: number }> => {
    await supabase.storage.from('event-documents').remove([oldPath]);
    return adminDocumentsService.uploadFile(eventId, file);
  },

  getSignedUrl: async (filePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('event-documents')
      .createSignedUrl(filePath, 3600);

    if (error) throw new Error(error.message);
    return data.signedUrl;
  },

  getActivities: async (eventId: string): Promise<Pick<EventActivity, 'id' | 'title' | 'scheduled_date'>[]> => {
    const { data, error } = await supabase
      .from('event_activities')
      .select('id, title, scheduled_date')
      .eq('event_id', eventId)
      .order('scheduled_date')
      .order('start_time');

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  incrementDownload: async (docId: string): Promise<void> => {
    // Use RPC or raw update
    const { error } = await supabase.rpc('increment_download_count' as never, { _doc_id: docId } as never);
    // Fallback: if RPC doesn't exist, silently ignore
    if (error) {
      // Direct update as fallback
      const { data } = await supabase.from('documents').select('download_count').eq('id', docId).single();
      if (data) {
        await supabase.from('documents').update({ download_count: ((data as Record<string, number>).download_count ?? 0) + 1 }).eq('id', docId);
      }
    }
  },
};
