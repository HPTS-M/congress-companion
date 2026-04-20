-- Drop the constraint that breaks multiple_choice polls (only 1 row per attendee per poll)
ALTER TABLE public.poll_responses 
  DROP CONSTRAINT IF EXISTS poll_responses_poll_id_attendee_id_key;

-- Replacement: an attendee can submit multiple rows for the same poll
-- (one per option in multiple_choice), but cannot duplicate the same option,
-- nor send more than one open_text response (option_id IS NULL treated as equal).
ALTER TABLE public.poll_responses
  ADD CONSTRAINT poll_responses_unique_option_per_attendee
  UNIQUE NULLS NOT DISTINCT (poll_id, attendee_id, option_id);