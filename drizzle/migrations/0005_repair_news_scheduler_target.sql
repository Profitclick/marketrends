CREATE OR REPLACE FUNCTION public.cron_invoke(_fn text, _body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req_id bigint; scheduler_token text;
BEGIN
  IF _fn !~ '^[a-z][a-z0-9-]*$' THEN RAISE EXCEPTION 'invalid function name'; END IF;
  SELECT token INTO scheduler_token FROM public.cron_tokens WHERE name='scheduler';
  IF scheduler_token IS NULL OR scheduler_token='' THEN RAISE EXCEPTION 'scheduler token missing'; END IF;
  SELECT net.http_post(
    url := 'https://jsfzdlgfxvnlosrsafjw.lovable.cloud/functions/v1/' || _fn,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',scheduler_token),
    body := _body, timeout_milliseconds := 120000
  ) INTO req_id;
  RETURN req_id;
END; $$;
REVOKE ALL ON FUNCTION public.cron_invoke(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cron_invoke(text,jsonb) TO service_role;