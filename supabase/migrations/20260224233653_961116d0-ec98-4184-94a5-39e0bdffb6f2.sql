
-- Add auth-related columns to providers table
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_login timestamptz,
  ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON public.providers(user_id);

-- RLS: Providers can read their own record via auth
CREATE POLICY "Providers read own record"
ON public.providers FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- RLS: Providers can read their assigned services
CREATE POLICY "Providers read own assigned services"
ON public.provider_services FOR SELECT TO authenticated
USING (
  provider_id IN (
    SELECT id FROM public.providers
    WHERE user_id = auth.uid()
  )
);

-- RLS: Providers can read service_catalog for their assigned services
CREATE POLICY "Providers read assigned service catalog"
ON public.service_catalog FOR SELECT TO authenticated
USING (
  id IN (
    SELECT ps.service_catalog_id
    FROM public.provider_services ps
    JOIN public.providers p ON p.id = ps.provider_id
    WHERE p.user_id = auth.uid()
  )
);

-- RLS: Providers can read attendee_services for their assigned services
CREATE POLICY "Providers read attendee services for assigned"
ON public.attendee_services FOR SELECT TO authenticated
USING (
  service_catalog_id IN (
    SELECT ps.service_catalog_id
    FROM public.provider_services ps
    JOIN public.providers p ON p.id = ps.provider_id
    WHERE p.user_id = auth.uid()
  )
);

-- RLS: Providers can read service_tickets for their assigned services
CREATE POLICY "Providers read tickets for assigned services"
ON public.service_tickets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.attendee_services aser
    JOIN public.provider_services ps ON ps.service_catalog_id = aser.service_catalog_id
    JOIN public.providers p ON p.id = ps.provider_id
    WHERE aser.id = service_tickets.attendee_service_id
      AND p.user_id = auth.uid()
  )
);

-- RLS: Providers can read attendee basic info for their services
CREATE POLICY "Providers read attendees for assigned services"
ON public.attendees FOR SELECT TO authenticated
USING (
  id IN (
    SELECT aser.attendee_id
    FROM public.attendee_services aser
    JOIN public.provider_services ps ON ps.service_catalog_id = aser.service_catalog_id
    JOIN public.providers p ON p.id = ps.provider_id
    WHERE p.user_id = auth.uid()
  )
);

-- Set default access_expires_at for existing providers based on their event end_date + 7 days
UPDATE public.providers p
SET access_expires_at = (
  SELECT e.end_date::timestamptz + interval '7 days'
  FROM public.events e
  WHERE e.id = p.event_id
)
WHERE p.access_expires_at IS NULL;
