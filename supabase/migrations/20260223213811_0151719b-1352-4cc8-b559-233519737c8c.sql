-- Grant SELECT permission that is currently missing at the table level
GRANT SELECT ON public.attendees TO authenticated;
GRANT SELECT ON public.attendees TO anon;