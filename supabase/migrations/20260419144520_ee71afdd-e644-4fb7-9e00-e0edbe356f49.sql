
-- Add new columns to announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_resent_at timestamptz NULL;

-- Backfill sent_at for existing rows (treat existing as already sent)
UPDATE public.announcements
SET sent_at = COALESCE(sent_at, now())
WHERE sent_at IS NULL AND scheduled_for IS NULL;

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Unique title per event (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS announcements_event_title_unique
  ON public.announcements (event_id, lower(title));

-- Helpful index for cron lookup
CREATE INDEX IF NOT EXISTS announcements_pending_schedule_idx
  ON public.announcements (scheduled_for)
  WHERE sent_at IS NULL AND scheduled_for IS NOT NULL;

-- Enable required extensions for cron-driven dispatch
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: invoke dispatch edge function every minute
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-scheduled-announcements') THEN
    PERFORM cron.unschedule('dispatch-scheduled-announcements');
  END IF;

  PERFORM cron.schedule(
    'dispatch-scheduled-announcements',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://ucotwtuclnpsrmbbvrsk.supabase.co/functions/v1/dispatch-scheduled-announcements',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjb3R3dHVjbG5wc3JtYmJ2cnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTU4NDgsImV4cCI6MjA4MDE5MTg0OH0.luewcGYrzxSCEzzJfl1-qYwEEQ7W6u5ZA_tznJVawzo"}'::jsonb,
      body := jsonb_build_object('triggered_at', now())
    );
    $cron$
  );
END $$;
