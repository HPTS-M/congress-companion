import { supabase } from '@/integrations/supabase/client';
import { measure } from '@/lib/perf';

const LEVEL_ORDER = ['gold', 'silver', 'bronze', 'exhibitor'];
const BUCKET = 'event-sponsors';

function resolveStorageUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export interface Sponsor {
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
  video_url: string | null;
  social_linkedin: string | null;
  social_instagram: string | null;
  social_twitter: string | null;
  whatsapp_message: string | null;
  created_at: string | null;
}

export const sponsorsService = {
  getByEvent: async (eventId: string): Promise<Sponsor[]> => {
    return measure('list.sponsors', async () => {
      const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .eq('event_id', eventId)
        .order('name');

      if (error) throw new Error(error.message);

      const sorted = (data as Sponsor[]).sort((a, b) => {
      // getPublicUrl is synchronous — map URLs directly without Promise.all.
      const out = sorted.map((s) => ({
        ...s,
        logo_url: resolveStorageUrl(s.logo_url),
        materials_url: resolveStorageUrl(s.materials_url),
      }));

      return out;
    });
  },

  getById: async (sponsorId: string): Promise<Sponsor> => {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('id', sponsorId)
      .single();

    if (error) throw new Error(error.message);
    const sponsor = data as Sponsor;

    return {
      ...sponsor,
      logo_url: resolveStorageUrl(sponsor.logo_url),
      materials_url: resolveStorageUrl(sponsor.materials_url),
    };
  },
};
