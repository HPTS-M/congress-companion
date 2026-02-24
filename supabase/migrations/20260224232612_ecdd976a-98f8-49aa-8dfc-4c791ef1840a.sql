-- Insert test provider (data seed, not schema change — but using migration as it's the available tool)
INSERT INTO public.providers (event_id, company_name, category, contact_name, contact_email, access_code, is_active)
VALUES (
  '5efca36a-deef-489b-be85-3dc9d1501ed7',
  'Transportes Medellín S.A.',
  'transport',
  'Carlos Vélez',
  'cvelez@transportmed.com',
  'PROV01',
  true
);

-- Assign to "Traslado Aeropuerto - Hotel" service
INSERT INTO public.provider_services (provider_id, service_catalog_id)
SELECT p.id, 'a1000001-0000-0000-0000-000000000001'::uuid
FROM public.providers p
WHERE p.access_code = 'PROV01' 
  AND p.event_id = '5efca36a-deef-489b-be85-3dc9d1501ed7'
ON CONFLICT DO NOTHING;