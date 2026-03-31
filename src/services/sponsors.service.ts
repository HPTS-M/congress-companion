import { supabase } from '@/integrations/supabase/client';

const LEVEL_ORDER = ['gold', 'silver', 'bronze', 'exhibitor'];
const BUCKET = 'event-sponsors';

async function resolveStorageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
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
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('event_id', eventId)
      .order('name');

    if (error) throw new Error(error.message);

    const sorted = (data as Sponsor[]).sort((a, b) => {
      const levelDiff = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
      if (levelDiff !== 0) return levelDiff;
      return a.name.localeCompare(b.name);
    });

    const resolved = await Promise.all(
      sorted.map(async (s) => ({
        ...s,
        logo_url: await resolveStorageUrl(s.logo_url),
        materials_url: await resolveStorageUrl(s.materials_url),
      }))
    );

    return resolved;
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
      logo_url: await resolveStorageUrl(sponsor.logo_url),
      materials_url: await resolveStorageUrl(sponsor.materials_url),
    };
  },
};
