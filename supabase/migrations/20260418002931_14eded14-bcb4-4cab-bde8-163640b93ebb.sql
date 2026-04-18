-- 1. Fix de datos: aceptar las solicitudes mutuas pendientes entre Mauricio y David
UPDATE public.contacts
SET status = 'accepted', connected_at = now()
WHERE id IN (
  '9fe55e03-8a90-4471-9808-40054814337e',
  '5a847b20-c262-4e0c-af9e-82f5431b1f95'
)
AND status = 'pending';

-- 2. RPC: accept_or_create_contact
-- Si existe solicitud pendiente inversa → la acepta (auto-match)
-- Si no → inserta nueva solicitud pendiente
CREATE OR REPLACE FUNCTION public.accept_or_create_contact(
  _event_id uuid,
  _target_attendee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_attendee_id uuid;
  v_existing_inverse_id uuid;
  v_existing_own_id uuid;
  v_existing_status text;
  v_new_id uuid;
BEGIN
  -- Obtener el attendee_id del usuario actual para este evento
  SELECT id INTO v_my_attendee_id
  FROM public.attendees
  WHERE user_id = auth.uid()
    AND event_id = _event_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_my_attendee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AN_ATTENDEE');
  END IF;

  IF v_my_attendee_id = _target_attendee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_CONNECT_SELF');
  END IF;

  -- ¿Ya envié yo una solicitud (o ya estoy conectado)?
  SELECT id, status INTO v_existing_own_id, v_existing_status
  FROM public.contacts
  WHERE event_id = _event_id
    AND user_id = v_my_attendee_id
    AND contact_id = _target_attendee_id
  LIMIT 1;

  IF v_existing_own_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'already_exists',
      'status', v_existing_status,
      'contact_id', v_existing_own_id
    );
  END IF;

  -- ¿Existe una solicitud pendiente del otro lado hacia mí?
  SELECT id INTO v_existing_inverse_id
  FROM public.contacts
  WHERE event_id = _event_id
    AND user_id = _target_attendee_id
    AND contact_id = v_my_attendee_id
    AND status = 'pending'
  LIMIT 1;

  IF v_existing_inverse_id IS NOT NULL THEN
    -- Auto-match: aceptar la solicitud existente
    UPDATE public.contacts
    SET status = 'accepted', connected_at = now()
    WHERE id = v_existing_inverse_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'auto_accepted',
      'status', 'accepted',
      'contact_id', v_existing_inverse_id
    );
  END IF;

  -- No existe ninguna → insertar nueva solicitud pendiente
  INSERT INTO public.contacts (event_id, user_id, contact_id, status)
  VALUES (_event_id, v_my_attendee_id, _target_attendee_id, 'pending')
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'status', 'pending',
    'contact_id', v_new_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_or_create_contact(uuid, uuid) TO authenticated;