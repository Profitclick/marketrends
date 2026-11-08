REVOKE EXECUTE ON FUNCTION public.start_pipeline_run(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_pipeline_run(uuid, text, integer, integer, integer, integer, integer, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_pipeline_run(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_pipeline_run(uuid, text, integer, integer, integer, integer, integer, integer, text, jsonb) TO service_role;