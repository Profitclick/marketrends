-- Tightened after validation: count distinct concepts (parenthetical variants collapse,
-- e.g. "Kunstig intelligens" + "Kunstig intelligens (AI)" = 1), and always require >=1 strong seed.
CREATE OR REPLACE FUNCTION public.preview_article_clusters()
RETURNS TABLE(article_id uuid, cluster_slug text, reason text, matched_refs jsonb, score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH hits AS (
    SELECT at.article_id, s.cluster_slug, s.node_type, s.node_name, s.strength
    FROM article_topics at JOIN cluster_seed_nodes s ON s.node_type='topic' AND s.node_id=at.topic_id
    UNION
    SELECT ae.article_id, s.cluster_slug, s.node_type, s.node_name, s.strength
    FROM article_entities ae JOIN cluster_seed_nodes s ON s.node_type='entity' AND s.node_id=ae.entity_id
  ), agg AS (
    SELECT h.article_id, h.cluster_slug,
      count(DISTINCT lower(trim(regexp_replace(node_name,'\s*\(.*\)\s*','','g')))) FILTER (WHERE strength='strong') AS strong_n,
      count(DISTINCT lower(trim(regexp_replace(node_name,'\s*\(.*\)\s*','','g')))) FILTER (WHERE strength='supporting') AS sup_n,
      bool_or(node_type='topic') AS has_topic,
      bool_or(node_type='entity') AS has_entity,
      jsonb_agg(DISTINCT jsonb_build_object('type',node_type,'name',node_name,'strength',strength)) AS refs
    FROM hits h GROUP BY 1,2
  )
  SELECT a.article_id, a.cluster_slug,
    CASE WHEN (a.has_topic AND a.has_entity) OR ar.category = ANY(cd.supporting_categories) THEN 'MULTI_SIGNAL_MATCH'
         WHEN a.has_topic THEN 'TOPIC_MATCH' ELSE 'ENTITY_MATCH' END,
    a.refs || CASE WHEN ar.category = ANY(cd.supporting_categories)
                   THEN jsonb_build_array(jsonb_build_object('type','category','name',ar.category)) ELSE '[]'::jsonb END,
    (a.strong_n*2 + a.sup_n + CASE WHEN ar.category = ANY(cd.supporting_categories) THEN 1 ELSE 0 END)::numeric
  FROM agg a
  JOIN articles ar ON ar.id=a.article_id AND ar.published = true
  JOIN cluster_definitions cd ON cd.slug=a.cluster_slug
  WHERE a.strong_n >= 2
     OR (a.strong_n >= 1 AND (a.sup_n >= 1 OR ar.category = ANY(cd.supporting_categories)));
$$;
REVOKE ALL ON FUNCTION public.preview_article_clusters() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_article_clusters() TO service_role;