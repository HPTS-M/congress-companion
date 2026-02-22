
-- Add access_code_hash column for attendee login authentication
ALTER TABLE public.attendees 
ADD COLUMN IF NOT EXISTS access_code_hash text;

-- Add comment explaining the column
COMMENT ON COLUMN public.attendees.access_code_hash IS 'bcrypt hash of the 8-char access code used for attendee login. Never store plain text.';
