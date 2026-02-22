
INSERT INTO public.service_catalog (id, event_id, name, description, service_type, valid_from, valid_until, location)
VALUES
  ('a1000001-0000-0000-0000-000000000001', '5efca36a-deef-489b-be85-3dc9d1501ed7', 'Traslado Aeropuerto - Hotel', 'Transfer desde aeropuerto José María Córdova', 'transport', '06:00', '18:00', 'Aeropuerto José María Córdova'),
  ('a1000001-0000-0000-0000-000000000002', '5efca36a-deef-489b-be85-3dc9d1501ed7', 'Almuerzo Día 1', 'Buffet en Restaurante Principal', 'food', '12:00', '14:00', 'Restaurante Principal'),
  ('a1000001-0000-0000-0000-000000000003', '5efca36a-deef-489b-be85-3dc9d1501ed7', 'Cena de Gala', 'Evento especial de networking', 'special', '19:00', '23:00', 'Salón de Eventos'),
  ('a1000001-0000-0000-0000-000000000004', '5efca36a-deef-489b-be85-3dc9d1501ed7', 'Tour Comuna 13', 'Arte urbano y transformación social de Medellín', 'tour', '15:00', '18:00', 'Comuna 13, Medellín'),
  ('a1000001-0000-0000-0000-000000000005', '5efca36a-deef-489b-be85-3dc9d1501ed7', 'Traslado Hotel - Aeropuerto', 'Transfer de regreso al aeropuerto', 'transport', '10:00', '18:00', 'Hotel sede');

INSERT INTO public.attendee_services (id, attendee_id, service_catalog_id, status, scheduled_date)
VALUES
  ('b2000001-0000-0000-0000-000000000001', 'fb9cb992-242e-41d2-98f8-cc28bf70edce', 'a1000001-0000-0000-0000-000000000001', 'completed', '2026-03-15'),
  ('b2000001-0000-0000-0000-000000000002', 'fb9cb992-242e-41d2-98f8-cc28bf70edce', 'a1000001-0000-0000-0000-000000000002', 'scheduled', '2026-03-15'),
  ('b2000001-0000-0000-0000-000000000003', 'fb9cb992-242e-41d2-98f8-cc28bf70edce', 'a1000001-0000-0000-0000-000000000003', 'scheduled', '2026-03-15'),
  ('b2000001-0000-0000-0000-000000000004', 'fb9cb992-242e-41d2-98f8-cc28bf70edce', 'a1000001-0000-0000-0000-000000000004', 'scheduled', '2026-03-16'),
  ('b2000001-0000-0000-0000-000000000005', 'fb9cb992-242e-41d2-98f8-cc28bf70edce', 'a1000001-0000-0000-0000-000000000005', 'scheduled', '2026-03-17');
