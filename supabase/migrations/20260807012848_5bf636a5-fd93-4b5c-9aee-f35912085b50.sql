CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  processed integer NOT NULL DEFAULT 0,
  published integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  duplicates_blocked integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pipeline_runs TO authenticated;
GRANT ALL ON public.pipeline_runs TO service_role;
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read pipeline runs" ON public.pipeline_runs;
CREATE POLICY "Admins can read pipeline runs" ON public.pipeline_runs
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_runs_one_active
  ON public.pipeline_runs (job_name) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS pipeline_runs_job_started
  ON public.pipeline_runs (job_name, started_at DESC);

-- Claim an exclusive lock for a job. Returns the run id, or NULL when a run is
-- already in flight. Runs older than stale_minutes are reclaimed as timed_out.
CREATE OR REPLACE FUNCTION public.start_pipeline_run(_job text, _stale_minutes integer DEFAULT 30)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  UPDATE public.pipeline_runs
     SET status = 'timed_out',
         completed_at = now(),
         duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::int * 1000,
         error = COALESCE(error, 'stale lock reclaimed')
   WHERE job_name = _job
     AND status = 'running'
     AND started_at < now() - make_interval(mins => _stale_minutes);

  BEGIN
    INSERT INTO public.pipeline_runs (job_name) VALUES (_job) RETURNING id INTO new_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN NULL;
  END;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_pipeline_run(
  _id uuid, _status text, _processed integer DEFAULT 0, _published integer DEFAULT 0,
  _updated integer DEFAULT 0, _duplicates_blocked integer DEFAULT 0, _failed integer DEFAULT 0,
  _retry_count integer DEFAULT 0, _error text DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.pipeline_runs
     SET status = _status,
         completed_at = now(),
         duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::int * 1000,
         processed = _processed, published = _published, updated = _updated,
         duplicates_blocked = _duplicates_blocked, failed = _failed,
         retry_count = _retry_count, error = _error, details = _details
   WHERE id = _id;
$$;

REVOKE ALL ON FUNCTION public.start_pipeline_run(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_pipeline_run(uuid, text, integer, integer, integer, integer, integer, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_pipeline_run(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_pipeline_run(uuid, text, integer, integer, integer, integer, integer, integer, text, jsonb) TO service_role;