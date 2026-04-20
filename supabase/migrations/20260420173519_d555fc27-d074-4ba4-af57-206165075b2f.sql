-- Add tables to supabase_realtime publication (idempotent)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'announcements','polls','event_activities','session_interests',
    'attendee_checkins','documents','sponsors','contacts',
    'attendee_notes','ratings','attendee_services','sponsor_leads'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- REPLICA IDENTITY FULL for tables that emit UPDATE/DELETE events
ALTER TABLE public.announcements      REPLICA IDENTITY FULL;
ALTER TABLE public.polls              REPLICA IDENTITY FULL;
ALTER TABLE public.event_activities   REPLICA IDENTITY FULL;
ALTER TABLE public.documents          REPLICA IDENTITY FULL;
ALTER TABLE public.sponsors           REPLICA IDENTITY FULL;
ALTER TABLE public.contacts           REPLICA IDENTITY FULL;
ALTER TABLE public.attendee_notes     REPLICA IDENTITY FULL;
ALTER TABLE public.ratings            REPLICA IDENTITY FULL;
ALTER TABLE public.attendee_services  REPLICA IDENTITY FULL;