ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS editorial_authority_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS authority_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_scored_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_articles_editorial_authority_score
  ON public.articles (editorial_authority_score DESC);