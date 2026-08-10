CREATE OR REPLACE FUNCTION public.infobip_relay_request(
  p_base text,
  p_path text,
  p_api_key text,
  p_payload jsonb DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_id bigint;
  v_headers jsonb := jsonb_build_object(
    'Authorization', 'App ' || p_api_key,
    'Accept', 'application/json'
  );
BEGIN
  IF p_payload IS NULL THEN
    SELECT net.http_get(url := p_base || p_path, headers := v_headers, timeout_milliseconds := 15000) INTO v_id;
  ELSE
    SELECT net.http_post(
      url := p_base || p_path,
      body := p_payload,
      headers := v_headers || jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 15000
    ) INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.infobip_relay_request(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.infobip_relay_request(text, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.infobip_relay_response(p_id bigint)
RETURNS TABLE (status_code int, content text, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
BEGIN
  RETURN QUERY
  SELECT r.status_code, r.content, r.error_msg
  FROM net._http_response r
  WHERE r.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.infobip_relay_response(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.infobip_relay_response(bigint) TO service_role;