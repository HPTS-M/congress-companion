import { supabase } from '@/integrations/supabase/client';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
}

export const emailService = {
  async sendEmail({ to, subject, html, fromName }: SendEmailParams) {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html, from_name: fromName },
    });

    if (error) throw new Error(error.message);
    return data as { success: boolean; id: string };
  },
};
