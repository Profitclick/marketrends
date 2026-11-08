CREATE OR REPLACE FUNCTION public.phase7c_reference_links() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
DELETE FROM internal_links WHERE source_type IN ('topic','entity','cluster') AND target_type IN ('topic','entity','guide','knowledge','comparison');
INSERT INTO internal_links(source_type,source_slug,target_type,target_slug,anchor,relevance_score)
SELECT DISTINCT source_type,source_slug,target_type,target_slug,anchor,relevance_score FROM (
SELECT 'topic'::text source_type,a.slug source_slug,'topic'::text target_type,b.slug target_slug,b.name anchor,coalesce(r.score,0.5) relevance_score FROM topic_relations r JOIN topics a ON a.id=r.topic_id JOIN topics b ON b.id=r.related_topic_id WHERE a.id<>b.id
UNION ALL SELECT 'entity',a.slug,'entity',b.slug,b.name,coalesce(r.score,0.5) FROM entity_relations r JOIN entities a ON a.id=r.entity_id JOIN entities b ON b.id=r.related_entity_id WHERE a.id<>b.id
UNION ALL SELECT 'cluster',c.slug,'guide',g.slug,g.title,0.9 FROM cluster_definitions c JOIN guides g ON g.category=ANY(c.guide_categories) AND g.published=true
UNION ALL SELECT 'cluster',s.cluster_slug,'knowledge',k.slug,k.title,0.9 FROM cluster_seed_nodes s JOIN knowledge_pages k ON ((s.node_type='topic' AND s.node_id=k.topic_id) OR (s.node_type='entity' AND s.node_id=k.entity_id)) AND k.published=true
UNION ALL SELECT 'cluster',s.cluster_slug,'comparison',c.slug,c.title,0.9 FROM cluster_seed_nodes s JOIN comparison_pages c ON s.node_type='entity' AND s.node_id IN(c.entity_a_id,c.entity_b_id) AND c.published=true
) x ON CONFLICT(source_type,source_slug,target_type,target_slug) DO UPDATE SET anchor=excluded.anchor,relevance_score=excluded.relevance_score;
GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.phase7c_reference_links() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.phase7c_reference_links() TO service_role;