
-- Add index on ai_status for pipeline queries
CREATE INDEX IF NOT EXISTS idx_articles_ai_status ON public.articles (ai_status);

-- Add composite index for published + created_at
CREATE INDEX IF NOT EXISTS idx_articles_published_created ON public.articles (published, created_at DESC);

-- Add composite index for category + published + created_at
CREATE INDEX IF NOT EXISTS idx_articles_category_published_created ON public.articles (category, published, created_at DESC);

-- Add index on slug
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles (slug);

-- Add index on source_url for dedup
CREATE INDEX IF NOT EXISTS idx_articles_source_url ON public.articles (source_url);
