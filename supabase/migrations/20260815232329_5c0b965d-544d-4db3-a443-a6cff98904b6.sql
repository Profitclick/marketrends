CREATE OR REPLACE FUNCTION public.graph_convergence_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total int; done int; emb int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) FILTER (WHERE published),
         count(*) FILTER (WHERE published AND enrichment_status LIKE 'complete%'),
         count(*) FILTER (WHERE published AND embedding IS NOT NULL)
    INTO total, done, emb FROM public.articles;

  RETURN jsonb_build_object(
    'total_eligible', total,
    'enriched', done,
    'embedded', emb,
    'enrichment_pct', CASE WHEN total = 0 THEN 0 ELSE round(done::numeric * 100 / total, 2) END,
    'embedding_pct', CASE WHEN total = 0 THEN 0 ELSE round(emb::numeric * 100 / total, 2) END,
    'converged', (total > 0 AND done::numeric / total >= 0.95 AND emb::numeric / total >= 0.95)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.graph_convergence_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.graph_convergence_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.graph_convergence_status() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.archive_backfill_progress() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_backfill_progress() FROM anon;
GRANT EXECUTE ON FUNCTION public.archive_backfill_progress() TO authenticated, service_role;

REVOKE ALL ON public.node_merge_candidates FROM anon;
REVOKE ALL ON public.pipeline_runs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.node_merge_candidates TO authenticated;
GRANT SELECT ON public.pipeline_runs TO authenticated;
GRANT ALL ON public.node_merge_candidates TO service_role;
GRANT ALL ON public.pipeline_runs TO service_role;

UPDATE public.articles
SET enrichment_status = 'pending',
    enrich_retry_count = 0,
    enrich_failure_reason = NULL
WHERE enrichment_status IN ('failed','retry')
  AND enrich_failure_reason LIKE '%402%';