
-- 1. SECURITY: revoke leftover public-role privileges on the scheduler token table
REVOKE ALL ON public.cron_tokens FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.cron_tokens TO service_role;
ALTER TABLE public.cron_tokens FORCE ROW LEVEL SECURITY;

-- 2. ARCHIVE ENRICHMENT TRACKING
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrich_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrich_failure_reason text;

ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_enrichment_status_chk;
ALTER TABLE public.articles ADD CONSTRAINT articles_enrichment_status_chk
  CHECK (enrichment_status IN ('pending','retry','complete_with_relations','complete_no_relations','failed'));

-- Idempotent classification of existing rows from data already present
UPDATE public.articles a
SET enrichment_status = 'complete_with_relations',
    last_enriched_at = COALESCE(a.last_enriched_at, a.updated_at)
WHERE a.enrichment_status = 'pending'
  AND (EXISTS (SELECT 1 FROM public.article_topics t WHERE t.article_id = a.id)
    OR EXISTS (SELECT 1 FROM public.article_entities e WHERE e.article_id = a.id));

CREATE INDEX IF NOT EXISTS idx_articles_enrichment_queue
  ON public.articles (enrichment_status, created_at DESC)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_articles_last_enriched
  ON public.articles (last_enriched_at DESC);

-- 3. ADMIN-ONLY FACTUAL PROGRESS REPORT
CREATE OR REPLACE FUNCTION public.archive_backfill_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
  done_last_hour int;
  rate numeric;
  remaining int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO done_last_hour
  FROM public.articles
  WHERE last_enriched_at > now() - interval '1 hour';

  SELECT count(*) INTO remaining
  FROM public.articles
  WHERE published AND enrichment_status IN ('pending','retry');

  rate := NULLIF(done_last_hour, 0);

  SELECT jsonb_build_object(
    'total_eligible', count(*) FILTER (WHERE published),
    'enriched', count(*) FILTER (WHERE published AND enrichment_status LIKE 'complete%'),
    'complete_with_relations', count(*) FILTER (WHERE published AND enrichment_status = 'complete_with_relations'),
    'complete_no_relations', count(*) FILTER (WHERE published AND enrichment_status = 'complete_no_relations'),
    'pending', count(*) FILTER (WHERE published AND enrichment_status = 'pending'),
    'retry_queue', count(*) FILTER (WHERE published AND enrichment_status = 'retry'),
    'failed', count(*) FILTER (WHERE published AND enrichment_status = 'failed'),
    'embedded', count(*) FILTER (WHERE published AND embedding IS NOT NULL),
    'remaining_embeddings', count(*) FILTER (WHERE published AND embedding IS NULL),
    'remaining_enrichment', remaining,
    'enriched_last_hour', done_last_hour,
    'rate_per_hour', done_last_hour,
    'eta_hours', CASE WHEN rate IS NULL THEN NULL ELSE round(remaining::numeric / rate, 1) END
  ) INTO res
  FROM public.articles;

  RETURN res || jsonb_build_object(
    'failed_last_hour', (SELECT count(*) FROM public.articles
       WHERE enrichment_status = 'failed' AND last_enriched_at > now() - interval '1 hour'),
    'runs_last_hour', (SELECT count(*) FROM public.pipeline_runs
       WHERE job_name = 'backfill-enrichment' AND started_at > now() - interval '1 hour'),
    'measured_at', to_jsonb(now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_backfill_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_backfill_progress() TO authenticated, service_role;

-- 4. GRAPH HYGIENE REVIEW QUEUE (no automatic merging of ambiguous nodes)
CREATE TABLE IF NOT EXISTS public.node_merge_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type text NOT NULL CHECK (node_type IN ('topic','entity')),
  primary_id uuid NOT NULL,
  duplicate_id uuid NOT NULL,
  primary_name text NOT NULL,
  duplicate_name text NOT NULL,
  reason text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review','merged','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (node_type, primary_id, duplicate_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.node_merge_candidates TO authenticated;
GRANT ALL ON public.node_merge_candidates TO service_role;
ALTER TABLE public.node_merge_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage merge candidates" ON public.node_merge_candidates;
CREATE POLICY "Admins manage merge candidates" ON public.node_merge_candidates
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
