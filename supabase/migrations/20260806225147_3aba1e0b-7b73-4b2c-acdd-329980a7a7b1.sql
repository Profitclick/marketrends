CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.articles          ADD COLUMN IF NOT EXISTS embedding vector(1536), ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
ALTER TABLE public.knowledge_pages   ADD COLUMN IF NOT EXISTS embedding vector(1536), ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
ALTER TABLE public.guides            ADD COLUMN IF NOT EXISTS embedding vector(1536), ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
ALTER TABLE public.comparison_pages  ADD COLUMN IF NOT EXISTS embedding vector(1536), ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
ALTER TABLE public.research_reports  ADD COLUMN IF NOT EXISTS embedding vector(1536), ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
ALTER TABLE public.search_intents    ADD COLUMN IF NOT EXISTS embedding vector(1536), ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

CREATE INDEX IF NOT EXISTS articles_embedding_idx         ON public.articles         USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS knowledge_pages_embedding_idx  ON public.knowledge_pages  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS guides_embedding_idx           ON public.guides           USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS comparison_pages_embedding_idx ON public.comparison_pages USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS research_reports_embedding_idx ON public.research_reports USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS search_intents_embedding_idx   ON public.search_intents   USING hnsw (embedding vector_cosine_ops);

-- Editorial log of every duplicate decision
CREATE TABLE IF NOT EXISTS public.duplicate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_type text NOT NULL,
  candidate_ref text NOT NULL,
  candidate_title text,
  decision text NOT NULL,
  match_type text,
  match_ref text,
  match_title text,
  similarity numeric,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duplicate_decisions TO authenticated;
GRANT ALL ON public.duplicate_decisions TO service_role;
ALTER TABLE public.duplicate_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage duplicate decisions" ON public.duplicate_decisions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS duplicate_decisions_created_idx ON public.duplicate_decisions (created_at DESC);

-- Cross-surface semantic match across all editorial content
CREATE OR REPLACE FUNCTION public.match_editorial_content(
  query_embedding vector(1536),
  match_threshold double precision DEFAULT 0.80,
  match_count int DEFAULT 10,
  exclude_ref text DEFAULT NULL
)
RETURNS TABLE (content_type text, ref text, title text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT 'article'::text AS content_type, a.slug AS ref, a.title, 1 - (a.embedding <=> query_embedding) AS similarity
      FROM public.articles a WHERE a.embedding IS NOT NULL AND a.published = true
    UNION ALL
    SELECT 'knowledge', k.slug, k.title, 1 - (k.embedding <=> query_embedding) FROM public.knowledge_pages k WHERE k.embedding IS NOT NULL
    UNION ALL
    SELECT 'guide', g.slug, g.title, 1 - (g.embedding <=> query_embedding) FROM public.guides g WHERE g.embedding IS NOT NULL
    UNION ALL
    SELECT 'comparison', c.slug, c.title, 1 - (c.embedding <=> query_embedding) FROM public.comparison_pages c WHERE c.embedding IS NOT NULL
    UNION ALL
    SELECT 'report', r.slug, r.title, 1 - (r.embedding <=> query_embedding) FROM public.research_reports r WHERE r.embedding IS NOT NULL
    UNION ALL
    SELECT 'intent', COALESCE(s.target_slug, s.id::text), s.keyword, 1 - (s.embedding <=> query_embedding)
      FROM public.search_intents s WHERE s.embedding IS NOT NULL AND s.content_status = 'published'
  )
  SELECT content_type, ref, title, similarity FROM candidates
  WHERE similarity >= match_threshold
    AND (exclude_ref IS NULL OR content_type || ':' || ref <> exclude_ref)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_editorial_content(vector, double precision, int, text) TO service_role;