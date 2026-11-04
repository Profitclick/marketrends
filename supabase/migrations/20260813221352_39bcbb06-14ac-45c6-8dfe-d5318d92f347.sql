
-- Deterministic name normalisation used only for duplicate DETECTION.
CREATE OR REPLACE FUNCTION public.normalize_node_name(s text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(
           regexp_replace(
             lower(translate(coalesce(s,''), 'æøåÆØÅéèüö', 'aoaAOAeeuo')),
             '\s+(as|asa|inc|ltd|llc|plc|corp|corporation|group|holding)\b', '', 'g'),
           '[^a-z0-9]', '', 'g');
$$;

-- Populates the review queue. Nothing is merged; ambiguous cases are queued.
CREATE OR REPLACE FUNCTION public.detect_node_merge_candidates()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_added int := 0; e_added int := 0;
BEGIN
  WITH pairs AS (
    SELECT a.id pid, b.id did, a.name pname, b.name dname,
           CASE WHEN lower(a.name) = lower(b.name) THEN 'casing_variant'
                WHEN public.normalize_node_name(a.name) = public.normalize_node_name(b.name) THEN 'normalized_variant'
                ELSE 'plural_variant' END AS reason,
           CASE WHEN lower(a.name) = lower(b.name) THEN 0.95 ELSE 0.7 END AS conf
    FROM public.entities a
    JOIN public.entities b
      ON a.id < b.id
     AND a.type = b.type
     AND (public.normalize_node_name(a.name) = public.normalize_node_name(b.name)
       OR public.normalize_node_name(a.name) = public.normalize_node_name(b.name) || 's')
  )
  INSERT INTO public.node_merge_candidates
    (node_type, primary_id, duplicate_id, primary_name, duplicate_name, reason, confidence)
  SELECT 'entity', pid, did, pname, dname, reason, conf FROM pairs
  ON CONFLICT (node_type, primary_id, duplicate_id) DO NOTHING;
  GET DIAGNOSTICS e_added = ROW_COUNT;

  WITH pairs AS (
    SELECT a.id pid, b.id did, a.name pname, b.name dname,
           CASE WHEN lower(a.name) = lower(b.name) THEN 'casing_variant'
                ELSE 'normalized_variant' END AS reason,
           CASE WHEN lower(a.name) = lower(b.name) THEN 0.95 ELSE 0.7 END AS conf
    FROM public.topics a
    JOIN public.topics b
      ON a.id < b.id
     AND (public.normalize_node_name(a.name) = public.normalize_node_name(b.name)
       OR public.normalize_node_name(a.name) = public.normalize_node_name(b.name) || 's')
  )
  INSERT INTO public.node_merge_candidates
    (node_type, primary_id, duplicate_id, primary_name, duplicate_name, reason, confidence)
  SELECT 'topic', pid, did, pname, dname, reason, conf FROM pairs
  ON CONFLICT (node_type, primary_id, duplicate_id) DO NOTHING;
  GET DIAGNOSTICS t_added = ROW_COUNT;

  RETURN jsonb_build_object('entity_candidates_added', e_added,
                            'topic_candidates_added', t_added,
                            'open_for_review',
                            (SELECT count(*) FROM public.node_merge_candidates WHERE status = 'review'));
END;
$$;

REVOKE ALL ON FUNCTION public.detect_node_merge_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_node_merge_candidates() TO service_role;

-- Convergence gate: is the archive repaired enough to rebuild derived scores?
CREATE OR REPLACE FUNCTION public.graph_convergence_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE total int; done int; emb int;
BEGIN
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

REVOKE ALL ON FUNCTION public.graph_convergence_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.graph_convergence_status() TO authenticated, service_role;
