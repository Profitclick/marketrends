-- Mutating / internal SECURITY DEFINER helpers: service_role and owner only (callers are edge functions with service role or scheduled SQL).
REVOKE EXECUTE ON FUNCTION public.classify_merge_candidates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_node_merge_candidates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_enrich_priority() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.candidate_nodes_for_article(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_editorial_content(vector, double precision, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.graph_ready_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.classify_merge_candidates() TO service_role;
GRANT EXECUTE ON FUNCTION public.detect_node_merge_candidates() TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_enrich_priority() TO service_role;
GRANT EXECUTE ON FUNCTION public.candidate_nodes_for_article(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_editorial_content(vector, double precision, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.graph_ready_status() TO service_role;