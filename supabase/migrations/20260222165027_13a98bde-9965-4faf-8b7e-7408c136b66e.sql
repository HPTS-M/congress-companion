
-- Rate limiting table for access code attempts
CREATE TABLE public.access_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  event_code text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_access_attempts_ip_time ON public.access_attempts (ip_address, attempted_at DESC);

-- Enable RLS and block all direct access (only edge function with service role uses this)
ALTER TABLE public.access_attempts ENABLE ROW LEVEL SECURITY;

-- Block anon access
CREATE POLICY "block_anon_access" ON public.access_attempts FOR SELECT TO anon USING (false);

-- Block authenticated access (only service role should touch this)
CREATE POLICY "block_authenticated_access" ON public.access_attempts FOR SELECT TO authenticated USING (false);

-- Cleanup function: delete attempts older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_old_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.access_attempts WHERE attempted_at < now() - interval '1 hour';
$$;
