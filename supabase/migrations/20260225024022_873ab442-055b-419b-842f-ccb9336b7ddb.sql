-- Insert test poll 1: single choice
INSERT INTO public.polls (event_id, question, poll_type, status)
VALUES (
  '5efca36a-deef-489b-be85-3dc9d1501ed7',
  '¿Qué tema te resultó más relevante en el taller de IA Generativa?',
  'single_choice',
  'active'
);

-- Insert options for poll 1
INSERT INTO public.poll_options (poll_id, option_text, order_index)
SELECT p.id, opt.text, opt.idx
FROM public.polls p
CROSS JOIN (VALUES
  ('Automatización de procesos', 0),
  ('Diagnóstico asistido', 1),
  ('Gestión de medicamentos', 2),
  ('Investigación clínica', 3)
) AS opt(text, idx)
WHERE p.question = '¿Qué tema te resultó más relevante en el taller de IA Generativa?'
  AND p.event_id = '5efca36a-deef-489b-be85-3dc9d1501ed7';

-- Insert test poll 2: rating scale
INSERT INTO public.polls (event_id, question, poll_type, status)
VALUES (
  '5efca36a-deef-489b-be85-3dc9d1501ed7',
  '¿Cómo calificarías la organización general del congreso?',
  'rating_scale',
  'active'
);

-- Insert rating options (1-5) for poll 2
INSERT INTO public.poll_options (poll_id, option_text, order_index)
SELECT p.id, opt.text, opt.idx
FROM public.polls p
CROSS JOIN (VALUES
  ('1', 0),
  ('2', 1),
  ('3', 2),
  ('4', 3),
  ('5', 4)
) AS opt(text, idx)
WHERE p.question = '¿Cómo calificarías la organización general del congreso?'
  AND p.event_id = '5efca36a-deef-489b-be85-3dc9d1501ed7';