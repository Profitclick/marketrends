-- Candidate retrieval for candidate-constrained enrichment.
-- Returns canonical entity/topic nodes retrieved by (a) lexical matching against
-- the article text and (b) nodes used by the article's nearest embedding
-- neighbours. Retrieval only — these are proposals for AI adjudication, never
-- evidence sufficient to create a relation.
CREATE OR REPLACE FUNCTION public.candidate_nodes_for_article(
  _article_id uuid,
  _neighbours integer DEFAULT 12,
  _limit integer DEFAULT 60
)
RETURNS TABLE(node_type text, id uuid, name text, ntype text, source text, score numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE emb vector; hay text;
BEGIN
  SELECT a.embedding, lower(coalesce(a.title,'') || ' ' || coalesce(a.content,''))
    INTO emb, hay
  FROM public.articles a WHERE a.id = _article_id;
  IF hay IS NULL THEN RETURN; END IF;
  hay := left(hay, 20000);

  RETURN QUERY
  WITH nb AS (
    SELECT a2.id FROM public.articles a2
    WHERE emb IS NOT NULL AND a2.embedding IS NOT NULL AND a2.id <> _article_id
    ORDER BY a2.embedding <=> emb
    LIMIT _neighbours
  ),
  ent_lex AS (
    SELECT e.id, e.name, e.type, 'lexical'::text AS src, 1.0::numeric AS sc
    FROM public.entities e
    WHERE length(e.name) >= 3
      AND (position(lower(e.name) in hay) > 0
        OR EXISTS (SELECT 1 FROM unnest(e.aliases) al
                   WHERE length(al) >= 3 AND position(lower(al) in hay) > 0))
    LIMIT 40
  ),
  ent_nb AS (
    SELECT e.id, e.name, e.type, 'neighbour'::text AS src,
           least(0.9, 0.3 + count(*)::numeric / 10) AS sc
    FROM public.article_entities ae
    JOIN nb ON nb.id = ae.article_id
    JOIN public.entities e ON e.id = ae.entity_id
    GROUP BY e.id, e.name, e.type
    ORDER BY count(*) DESC
    LIMIT 30
  ),
  top_lex AS (
    SELECT t.id, t.name, NULL::text AS type, 'lexical'::text AS src, 1.0::numeric AS sc
    FROM public.topics t
    WHERE length(t.name) >= 3 AND position(lower(t.name) in hay) > 0
    LIMIT 40
  ),
  top_nb AS (
    SELECT t.id, t.name, NULL::text AS type, 'neighbour'::text AS src,
           least(0.9, 0.3 + count(*)::numeric / 10) AS sc
    FROM public.article_topics at
    JOIN nb ON nb.id = at.article_id
    JOIN public.topics t ON t.id = at.topic_id
    GROUP BY t.id, t.name
    ORDER BY count(*) DESC
    LIMIT 30
  ),
  unioned AS (
    SELECT 'entity'::text nt, * FROM (SELECT * FROM ent_lex UNION ALL SELECT * FROM ent_nb) x
    UNION ALL
    SELECT 'topic'::text nt, * FROM (SELECT * FROM top_lex UNION ALL SELECT * FROM top_nb) y
  )
  SELECT u.nt, u.id, u.name, u.type, max(u.src), max(u.sc)
  FROM unioned u
  GROUP BY u.nt, u.id, u.name, u.type
  ORDER BY max(u.sc) DESC, u.name
  LIMIT _limit;
END;
$$;
REVOKE ALL ON FUNCTION public.candidate_nodes_for_article(uuid, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.candidate_nodes_for_article(uuid, integer, integer) TO service_role;