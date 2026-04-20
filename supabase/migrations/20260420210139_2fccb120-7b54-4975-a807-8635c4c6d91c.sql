DELETE FROM public.access_attempts 
WHERE ip_address IN ('177.253.145.90', '181.130.220.114')
  AND attempted_at > now() - interval '30 minutes';