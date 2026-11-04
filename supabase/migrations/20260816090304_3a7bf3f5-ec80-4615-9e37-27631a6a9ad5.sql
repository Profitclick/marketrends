-- 1. Enrichment telemetry
CREATE TABLE IF NOT EXISTS public.enrichment_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  run_id uuid,
  mode text NOT NULL DEFAULT 'candidate_constrained',
  ai_calls int NOT NULL DEFAULT 0,
  ai_success boolean NOT NULL DEFAULT false,
  failure_reason text,
  model text,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  credits numeric,
  candidates_offered int NOT NULL DEFAULT 0,
  canonical_entities_reused int NOT NULL DEFAULT 0,
  canonical_topics_reused int NOT NULL DEFAULT 0,
  new_entities_proposed int NOT NULL DEFAULT 0,
  new_topics_proposed int NOT NULL DEFAULT 0,
  new_entities_created int NOT NULL DEFAULT 0,
  new_topics_created int NOT NULL DEFAULT 0,
  entity_relations_created int NOT NULL DEFAULT 0,
  topic_relations_created int NOT NULL DEFAULT 0,
  singleton_nodes_created int NOT NULL DEFAULT 0,
  processing_ms int,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.enrichment_telemetry TO service_role;
GRANT SELECT ON public.enrichment_telemetry TO authenticated;
ALTER TABLE public.enrichment_telemetry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read enrichment telemetry" ON public.enrichment_telemetry;
CREATE POLICY "admins read enrichment telemetry" ON public.enrichment_telemetry
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_enrich_telemetry_created ON public.enrichment_telemetry (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrich_telemetry_article ON public.enrichment_telemetry (article_id);

-- 2. Canonical-vocabulary retrieval support
CREATE INDEX IF NOT EXISTS idx_entities_norm_name ON public.entities (public.normalize_node_name(name));
CREATE INDEX IF NOT EXISTS idx_topics_norm_name ON public.topics (public.normalize_node_name(name));
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm ON public.entities USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_topics_name_trgm ON public.topics USING gin (name gin_trgm_ops);

-- 3. Priority scorer: which archive articles are worth enriching first
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS enrich_priority numeric NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_articles_enrich_queue
  ON public.articles (enrichment_status, enrich_priority DESC)
  WHERE published;

CREATE OR REPLACE FUNCTION public.recompute_enrich_priority()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n int;
BEGIN
  WITH scored AS (
    SELECT a.id,
      -- editorial authority (0-1) weighted highest
      COALESCE(a.editorial_authority_score, 0) / 100.0 * 3.0
      -- recency: 1.0 today decaying over ~2 years
      + GREATEST(0, 1 - EXTRACT(EPOCH FROM (now() - a.created_at)) / (2 * 365 * 86400)) * 2.0
      -- internal linking value: existing inbound/outbound links
      + LEAST(1.0, COALESCE(l.link_count, 0) / 5.0) * 1.5
      -- content substance
      + LEAST(1.0, length(a.content) / 6000.0) * 1.0
      -- already-known vocabulary anchor: article has tags to match against
      + LEAST(1.0, COALESCE(array_length(a.tags, 1), 0) / 5.0) * 0.5 AS score
    FROM public.articles a
    LEFT JOIN LATERAL (
      SELECT count(*) AS link_count FROM public.internal_links il
      WHERE il.target_type = 'article' AND il.target_slug = a.slug
    ) l ON true
    WHERE a.published
  )
  UPDATE public.articles a
     SET enrich_priority = round(s.score::numeric, 4)
    FROM scored s
   WHERE a.id = s.id AND a.enrich_priority IS DISTINCT FROM round(s.score::numeric, 4);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.recompute_enrich_priority() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_enrich_priority() TO service_role;
SELECT public.recompute_enrich_priority();

-- 4. Manual, provable-identity merge helper (never invoked automatically)
CREATE OR REPLACE FUNCTION public.merge_nodes(_node_type text, _primary uuid, _duplicate uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE moved int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _primary = _duplicate THEN RAISE EXCEPTION 'primary and duplicate are identical'; END IF;

  IF _node_type = 'entity' THEN
    -- preserve aliases
    UPDATE public.entities p
       SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(p.aliases || d.aliases || ARRAY[d.name]) x)
      FROM public.entities d
     WHERE p.id = _primary AND d.id = _duplicate;
    -- preserve relations
    UPDATE public.article_entities ae SET entity_id = _primary
     WHERE ae.entity_id = _duplicate
       AND NOT EXISTS (SELECT 1 FROM public.article_entities x
                       WHERE x.article_id = ae.article_id AND x.entity_id = _primary);
    GET DIAGNOSTICS moved = ROW_COUNT;
    DELETE FROM public.article_entities WHERE entity_id = _duplicate;
    UPDATE public.entity_relations SET entity_id = _primary WHERE entity_id = _duplicate;
    UPDATE public.entity_relations SET related_entity_id = _primary WHERE related_entity_id = _duplicate;
    DELETE FROM public.entity_relations WHERE entity_id = related_entity_id;
    UPDATE public.entity_metrics SET entity_id = _primary WHERE entity_id = _duplicate;
    UPDATE public.knowledge_pages SET entity_id = _primary WHERE entity_id = _duplicate;
    UPDATE public.opportunities SET entity_id = _primary WHERE entity_id = _duplicate;
    UPDATE public.search_intents SET entity_id = _primary WHERE entity_id = _duplicate;
    UPDATE public.search_intents SET secondary_entity_id = _primary WHERE secondary_entity_id = _duplicate;
    UPDATE public.comparison_pages SET entity_a_id = _primary WHERE entity_a_id = _duplicate;
    UPDATE public.comparison_pages SET entity_b_id = _primary WHERE entity_b_id = _duplicate;
    UPDATE public.topics SET hero_entity_id = _primary WHERE hero_entity_id = _duplicate;
    UPDATE public.entities p SET mention_count = p.mention_count + d.mention_count
      FROM public.entities d WHERE p.id = _primary AND d.id = _duplicate;
    DELETE FROM public.entities WHERE id = _duplicate;
  ELSIF _node_type = 'topic' THEN
    UPDATE public.article_topics at SET topic_id = _primary
     WHERE at.topic_id = _duplicate
       AND NOT EXISTS (SELECT 1 FROM public.article_topics x
                       WHERE x.article_id = at.article_id AND x.topic_id = _primary);
    GET DIAGNOSTICS moved = ROW_COUNT;
    DELETE FROM public.article_topics WHERE topic_id = _duplicate;
    UPDATE public.topic_relations SET topic_id = _primary WHERE topic_id = _duplicate;
    UPDATE public.topic_relations SET related_topic_id = _primary WHERE related_topic_id = _duplicate;
    DELETE FROM public.topic_relations WHERE topic_id = related_topic_id;
    UPDATE public.knowledge_pages SET topic_id = _primary WHERE topic_id = _duplicate;
    UPDATE public.opportunities SET topic_id = _primary WHERE topic_id = _duplicate;
    UPDATE public.search_intents SET topic_id = _primary WHERE topic_id = _duplicate;
    DELETE FROM public.topics WHERE id = _duplicate;
  ELSE
    RAISE EXCEPTION 'unknown node_type %', _node_type;
  END IF;

  UPDATE public.node_merge_candidates
     SET status = 'merged', reviewed_at = now()
   WHERE node_type = _node_type AND primary_id = _primary AND duplicate_id = _duplicate;

  RETURN jsonb_build_object('node_type', _node_type, 'primary_id', _primary,
                            'duplicate_id', _duplicate, 'relations_moved', moved);
END;
$$;
REVOKE ALL ON FUNCTION public.merge_nodes(text, uuid, uuid) FROM public, anon;

-- 5. Populate merge candidates for review (no merging performed)
SELECT public.detect_node_merge_candidates();

-- 6. Formal GRAPH_READY definition (reporting only; production gate unchanged)
CREATE OR REPLACE FUNCTION public.graph_ready_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  /*
    GRAPH_READY (formal definition, v1):
    A published article is GRAPH_READY when ALL of the following hold:
      1. embedding IS NOT NULL (retrievable)
      2. enrichment_status reached a terminal state:
         'complete_with_relations' | 'complete_no_relations' | 'failed_permanent'
      3. it has at least one article->topic OR article->entity relation,
         OR it is terminally classified as legitimately relation-free
         ('complete_no_relations').
    GRAPH_READY is a reporting metric only. The production gate is unchanged.
  */
  SELECT jsonb_build_object(
    'total_published', count(*) FILTER (WHERE a.published),
    'embedded', count(*) FILTER (WHERE a.published AND a.embedding IS NOT NULL),
    'terminal_state', count(*) FILTER (WHERE a.published AND a.enrichment_status LIKE 'complete%'),
    'with_relations', count(*) FILTER (WHERE a.published AND r.has_rel),
    'graph_ready', count(*) FILTER (WHERE a.published AND a.embedding IS NOT NULL
                                     AND a.enrichment_status LIKE 'complete%'),
    'graph_ready_pct', CASE WHEN count(*) FILTER (WHERE a.published) = 0 THEN 0 ELSE
        round(count(*) FILTER (WHERE a.published AND a.embedding IS NOT NULL
              AND a.enrichment_status LIKE 'complete%')::numeric * 100
              / count(*) FILTER (WHERE a.published), 2) END,
    'definition_version', 1,
    'gate_changed', false
  ) INTO res
  FROM public.articles a
  LEFT JOIN LATERAL (
    SELECT (EXISTS (SELECT 1 FROM public.article_topics t WHERE t.article_id = a.id)
         OR EXISTS (SELECT 1 FROM public.article_entities e WHERE e.article_id = a.id)) AS has_rel
  ) r ON true;
  RETURN res;
END;
$$;