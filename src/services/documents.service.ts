import { supabase } from '@/integrations/supabase/client';

export interface EventDocument {
  id: string;
  event_id: string;
  title: string;
  file_type: string | null;
  file_path: string;
  session_id: string | null;
  created_at: string | null;
  session_title: string | null;
}

export const documentsService = {
  getByEvent: async (eventId: string): Promise<EventDocument[]> => {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        event_id,
        title,
        file_type,
        file_path,
        session_id,
        created_at,
        event_activities!documents_session_id_fkey ( title )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((doc: any) => ({
      id: doc.id,
      event_id: doc.event_id,
      title: doc.title,
      file_type: doc.file_type,
      file_path: doc.file_path,
      session_id: doc.session_id,
      created_at: doc.created_at,
      session_title: doc.event_activities?.title ?? null,
    }));
  },

  getSignedUrl: async (filePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('event-documents')
      .createSignedUrl(filePath.replace('event-documents/', ''), 3600);

    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not generate URL');
    return data.signedUrl;
  },
};
