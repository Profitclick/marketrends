CREATE OR REPLACE FUNCTION public.cluster_membership_stats()
RETURNS TABLE(slug text, name text, articles bigint, last_7d bigint, last_30d bigint, last_article_at timestamptz,
              topics_represented bigint, entities_represented bigint, guides bigint, knowledge_pages bigint, comparisons bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cd.slug, cd.name,
    (SELECT count(*) FROM article_clusters ac JOIN articles a ON a.id=ac.article_id AND a.published WHERE ac.cluster_slug=cd.slug),
    (SELECT count(*) FROM article_clusters ac JOIN articles a ON a.id=ac.article_id AND a.published WHERE ac.cluster_slug=cd.slug AND a.created_at >= now()-interval '7 days'),
    (SELECT count(*) FROM article_clusters ac JOIN articles a ON a.id=ac.article_id AND a.published WHERE ac.cluster_slug=cd.slug AND a.created_at >= now()-interval '30 days'),
    (SELECT max(a.created_at) FROM article_clusters ac JOIN articles a ON a.id=ac.article_id AND a.published WHERE ac.cluster_slug=cd.slug),
    (SELECT count(DISTINCT at.topic_id) FROM article_clusters ac JOIN article_topics at ON at.article_id=ac.article_id WHERE ac.cluster_slug=cd.slug),
    (SELECT count(DISTINCT ae.entity_id) FROM article_clusters ac JOIN article_entities ae ON ae.article_id=ac.article_id WHERE ac.cluster_slug=cd.slug),
    (SELECT count(*) FROM guides g WHERE g.published AND g.category = ANY(cd.guide_categories)),
    (SELECT count(*) FROM knowledge_pages k WHERE k.published AND EXISTS (SELECT 1 FROM cluster_seed_nodes s WHERE s.cluster_slug=cd.slug
        AND ((s.node_type='topic' AND s.node_id=k.topic_id) OR (s.node_type='entity' AND s.node_id=k.entity_id)))),
    (SELECT count(*) FROM comparison_pages c WHERE c.published AND EXISTS (SELECT 1 FROM cluster_seed_nodes s WHERE s.cluster_slug=cd.slug
        AND s.node_type='entity' AND s.node_id IN (c.entity_a_id, c.entity_b_id)))
  FROM cluster_definitions cd;
$$;
REVOKE ALL ON FUNCTION public.cluster_membership_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cluster_membership_stats() TO service_role;