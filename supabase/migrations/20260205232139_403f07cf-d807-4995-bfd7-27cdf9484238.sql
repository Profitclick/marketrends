CREATE INDEX IF NOT EXISTS idx_articles_published_created ON articles (published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles (slug);