import { supabase } from '@/integrations/supabase/client';

const LEVEL_ORDER = ['gold', 'silver', 'bronze', 'exhibitor'];

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

    // Sort by level priority then name
    return (data as Sponsor[]).sort((a, b) => {
      const levelDiff = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
      if (levelDiff !== 0) return levelDiff;
      return a.name.localeCompare(b.name);
    });
  },

  getById: async (sponsorId: string): Promise<Sponsor> => {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('id', sponsorId)
      .single();

    if (error) throw new Error(error.message);
    return data as Sponsor;
  },
};
