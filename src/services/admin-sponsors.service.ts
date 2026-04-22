import { supabase } from '@/integrations/supabase/client';

export interface SponsorRow {
  id: string;
  event_id: string;
  name: string;
  level: string;
  category: string;
  description: string | null;
  stand_location: string | null;
  logo_url: string | null;
  website_url: string | null;
  materials_url: string | null;
  contact_email: string | null;
  whatsapp: string | null;
  whatsapp_message: string | null;
  video_url: string | null;
  social_linkedin: string | null;
  social_instagram: string | null;
  social_twitter: string | null;
  created_at: string | null;
  profile_views: number;
  whatsapp_clicks: number;
  website_clicks: number;
  materials_downloads: number;
}

export interface SponsorFormData {
  name: string;
  level: string;
  category: string;
  description?: string;
  stand_location?: string;
  website_url?: string;
  contact_email?: string;
  whatsapp?: string;
  whatsapp_message?: string;
  video_url?: string;
  social_linkedin?: string;
  social_instagram?: string;
  social_twitter?: string;
}

const BUCKET = 'event-sponsors';

export const adminSponsorsService = {
  async getAll(eventId: string): Promise<SponsorRow[]> {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('event_id', eventId)
      .order('level')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []) as SponsorRow[];
  },

  async findByName(eventId: string, name: string): Promise<SponsorRow | null> {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('event_id', eventId)
      .ilike('name', name.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as SponsorRow | null) ?? null;
  },

  async create(eventId: string, form: SponsorFormData): Promise<SponsorRow> {
    const { data, error } = await supabase
      .from('sponsors')
      .insert({ event_id: eventId, ...form })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as SponsorRow;
  },

  async update(
    id: string,
    form: Partial<SponsorFormData> & { logo_url?: string | null; materials_url?: string | null },
  ): Promise<SponsorRow | null> {
    // Use maybeSingle() so a successful UPDATE that returns no rows due to a
    // post-update SELECT being filtered by RLS does not surface as an error.
    const { data, error } = await supabase
      .from('sponsors')
      .update(form)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as SponsorRow | null) ?? null;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('sponsors')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async uploadFile(
    eventId: string,
    file: File,
    prefix: string,
  ): Promise<{ path: string; size: number }> {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const filename = `${prefix}-${Date.now()}.${ext}`;
    const path = `${eventId}/${filename}`;

    // Some files (Windows/Edge) come with file.type === ''. Force an explicit
    // contentType so Supabase Storage doesn't reject the upload.
    const fallbackType = prefix === 'materials' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const contentType = file.type || fallbackType;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType });
    if (error) throw new Error(error.message);

    // Best-effort post-upload verification (non-destructive).
    // If RLS or transient error blocks list(), trust the original file size.
    try {
      const { data: list } = await supabase.storage
        .from(BUCKET)
        .list(eventId, { search: filename });
      const uploaded = list?.find((o) => o.name === filename);
      const verifiedSize = (uploaded?.metadata as { size?: number } | null)?.size ?? 0;
      if (uploaded && verifiedSize > 0) {
        return { path, size: verifiedSize };
      }
    } catch {
      // ignore — fall through to file.size fallback
    }
    return { path, size: file.size };
  },

  async deleteFile(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([path]);
  },

  getSignedUrl: async (path: string): Promise<string> => {
    // Bucket is now public — getPublicUrl is synchronous and never fails.
    // Signature kept async for backward compatibility with consumers.
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },
};
