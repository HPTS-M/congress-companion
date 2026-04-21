-- Rename duplicates to unblock the unique index
WITH ranked AS (
  SELECT id,
         company_name,
         row_number() OVER (PARTITION BY event_id, lower(company_name) ORDER BY created_at) AS rn
  FROM public.providers
  WHERE company_name IS NOT NULL
)
UPDATE public.providers p
SET company_name = r.company_name || ' (' || r.rn || ')'
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS providers_event_company_name_unique
ON public.providers (event_id, lower(company_name))
WHERE company_name IS NOT NULL;