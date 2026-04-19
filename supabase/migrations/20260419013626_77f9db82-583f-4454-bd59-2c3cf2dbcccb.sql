-- 1. Poblar opciones 1-5 para rating_scale existentes que estén vacíos
INSERT INTO public.poll_options (poll_id, option_text, order_index)
SELECT p.id, gs::text, gs - 1
FROM public.polls p
CROSS JOIN generate_series(1, 5) AS gs
WHERE p.poll_type = 'rating_scale'
  AND NOT EXISTS (
    SELECT 1 FROM public.poll_options po WHERE po.poll_id = p.id
  );

-- 2. Trigger: auto-generar 5 opciones al crear poll rating_scale
CREATE OR REPLACE FUNCTION public.auto_create_rating_options()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.poll_type = 'rating_scale' THEN
    IF NOT EXISTS (SELECT 1 FROM public.poll_options WHERE poll_id = NEW.id) THEN
      INSERT INTO public.poll_options (poll_id, option_text, order_index)
      SELECT NEW.id, gs::text, gs - 1
      FROM generate_series(1, 5) AS gs;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_rating_options ON public.polls;
CREATE TRIGGER trg_auto_create_rating_options
  AFTER INSERT ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_rating_options();