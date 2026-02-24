-- Extend activity_type CHECK constraint to support new types
ALTER TABLE public.event_activities DROP CONSTRAINT event_activities_activity_type_check;
ALTER TABLE public.event_activities ADD CONSTRAINT event_activities_activity_type_check 
  CHECK (activity_type = ANY (ARRAY['talk'::text, 'workshop'::text, 'networking'::text, 'ceremony'::text, 'other'::text, 'symposium'::text, 'conference_day'::text]));