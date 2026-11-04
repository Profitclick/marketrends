-- Performance indexes for articles table
CREATE INDEX IF NOT EXISTS idx_articles_published_created_at ON public.articles (published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles (slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_source_url ON public.articles (source_url);
CREATE INDEX IF NOT EXISTS idx_articles_ai_status ON public.articles (ai_status);