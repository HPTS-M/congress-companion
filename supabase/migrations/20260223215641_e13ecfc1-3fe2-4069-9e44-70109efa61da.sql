-- Grant SELECT permission on documents table
GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT ON public.documents TO anon;

-- Insert 4 test documents
INSERT INTO public.documents (event_id, title, file_type, file_path, session_id) VALUES
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'Programa Académico XIII Congreso', 'pdf', 'event-documents/5efca36a-deef-489b-be85-3dc9d1501ed7/programa-academico.pdf', NULL),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'Farmacología Oncológica Avanzada', 'pptx', 'event-documents/5efca36a-deef-489b-be85-3dc9d1501ed7/farmacologia-oncologica.pptx', 'ecf95cd6-ca59-4999-ae71-e7033df99c21'),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'Guía de Uso Racional de Opioides', 'pdf', 'event-documents/5efca36a-deef-489b-be85-3dc9d1501ed7/guia-opioides.pdf', '5c39d6f2-037d-4ee6-a360-d4c167f08aca'),
  ('5efca36a-deef-489b-be85-3dc9d1501ed7', 'Abstract Book - XIII Congreso ACQFH', 'pdf', 'event-documents/5efca36a-deef-489b-be85-3dc9d1501ed7/abstract-book.pdf', NULL);