ALTER TABLE public.attendee_services
  DROP CONSTRAINT fk_service_catalog;

ALTER TABLE public.attendee_services
  ADD CONSTRAINT fk_service_catalog
  FOREIGN KEY (service_catalog_id)
  REFERENCES public.service_catalog(id)
  ON DELETE CASCADE;