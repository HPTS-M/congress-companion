
-- Add password_changed column to providers
ALTER TABLE public.providers
ADD COLUMN IF NOT EXISTS password_changed boolean NOT NULL DEFAULT false;

-- Allow providers to update their own record (for password_changed flag)
CREATE POLICY "Providers update own record"
ON public.providers FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
