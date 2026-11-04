-- Add article_type column for content differentiation
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS article_type TEXT DEFAULT 'news';

-- Add AI quality score for auto-publish logic
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS ai_quality_score DECIMAL(3,2);

-- Update existing categories to new structure
UPDATE public.articles SET category = 'Krypto & Trading' WHERE category IN ('Crypto', 'crypto', 'Trading', 'trading');
UPDATE public.articles SET category = 'Finans & Marked' WHERE category IN ('Fintech', 'fintech', 'Finance', 'finance', 'Money', 'money');
UPDATE public.articles SET category = 'Teknologi & AI' WHERE category IN ('Tech', 'tech', 'Technology', 'technology', 'AI', 'ai');
UPDATE public.articles SET category = 'Gründer & Startups' WHERE category IN ('Startup', 'startup', 'Startups', 'startups');
UPDATE public.articles SET category = 'Penger & Karriere' WHERE category IN ('Career', 'career', 'Personal Finance', 'personal finance');
UPDATE public.articles SET category = 'Trender & Analyse' WHERE category IN ('Analysis', 'analysis', 'Trends', 'trends');
UPDATE public.articles SET category = 'Guider & Forklart' WHERE category IN ('Guide', 'guide', 'Guides', 'guides', 'How-to', 'how-to');

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_type ON public.articles(article_type);
CREATE INDEX IF NOT EXISTS idx_articles_published_created ON public.articles(published, created_at DESC);