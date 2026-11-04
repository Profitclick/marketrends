-- Record the fuzzy (ambiguous) near-duplicate pairs as REVIEW candidates only.
-- Nothing is merged: these require human adjudication.
INSERT INTO public.node_merge_candidates
  (node_type, primary_id, duplicate_id, primary_name, duplicate_name, reason, confidence, status)
SELECT 'entity', a.id, b.id, a.name, b.name, 'fuzzy_lexical', round(similarity(a.name, b.name)::numeric, 3), 'review'
FROM public.entities a
JOIN public.entities b
  ON a.id < b.id
 AND a.type = b.type
 AND a.name % b.name
 AND similarity(a.name, b.name) >= 0.6
 AND public.normalize_node_name(a.name) <> public.normalize_node_name(b.name)
ON CONFLICT (node_type, primary_id, duplicate_id) DO NOTHING;

INSERT INTO public.node_merge_candidates
  (node_type, primary_id, duplicate_id, primary_name, duplicate_name, reason, confidence, status)
SELECT 'topic', a.id, b.id, a.name, b.name, 'fuzzy_lexical', round(similarity(a.name, b.name)::numeric, 3), 'review'
FROM public.topics a
JOIN public.topics b
  ON a.id < b.id
 AND a.name % b.name
 AND similarity(a.name, b.name) >= 0.6
 AND public.normalize_node_name(a.name) <> public.normalize_node_name(b.name)
ON CONFLICT (node_type, primary_id, duplicate_id) DO NOTHING;