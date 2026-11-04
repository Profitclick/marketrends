-- ============================================
-- AFFILIATE & COMMERCIALIZATION TABLES
-- ============================================

-- Affiliate Partners table
CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  utm_template TEXT NOT NULL,
  commission_rate DECIMAL(5,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Affiliate Clicks tracking
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  click_id TEXT NOT NULL UNIQUE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT
);

-- ============================================
-- OPEN DATA SOURCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL, -- 'nav', 'ssb', 'brreg', 'innovasjon_norge', 'data_norge', 'geonorge', 'doffin'
  source_name TEXT NOT NULL,
  api_endpoint TEXT,
  last_fetched TIMESTAMP WITH TIME ZONE,
  fetch_status TEXT, -- 'success', 'error', 'pending'
  data_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- SYSTEM LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  log_level TEXT NOT NULL, -- 'info', 'warning', 'error', 'critical'
  log_type TEXT NOT NULL, -- 'rss_fetch', 'ai_processing', 'data_ingest', 'affiliate_click', 'system'
  message TEXT NOT NULL,
  context JSONB,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  feed_id UUID REFERENCES public.rss_feeds(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster log queries
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_level ON public.system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON public.system_logs(log_type);

-- ============================================
-- ADD AFFILIATE FIELDS TO ARTICLES
-- ============================================

ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS affiliate_disclaimer TEXT,
ADD COLUMN IF NOT EXISTS risk_warning TEXT,
ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'success', 'error', 'credit_missing'
ADD COLUMN IF NOT EXISTS processing_log JSONB,
ADD COLUMN IF NOT EXISTS archived_sources JSONB; -- web.archive.org links

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage affiliate partners
CREATE POLICY "Authenticated users can manage affiliate partners"
ON public.affiliate_partners FOR ALL
USING (auth.role() = 'authenticated');

-- Anyone can insert affiliate clicks (tracking)
CREATE POLICY "Anyone can insert affiliate clicks"
ON public.affiliate_clicks FOR INSERT
WITH CHECK (true);

-- Only authenticated users can view clicks
CREATE POLICY "Authenticated users can view affiliate clicks"
ON public.affiliate_clicks FOR SELECT
USING (auth.role() = 'authenticated');

-- Authenticated users can manage data sources
CREATE POLICY "Authenticated users can manage data sources"
ON public.data_sources FOR ALL
USING (auth.role() = 'authenticated');

-- Authenticated users can view and insert logs
CREATE POLICY "Authenticated users can manage system logs"
ON public.system_logs FOR ALL
USING (auth.role() = 'authenticated');

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

CREATE TRIGGER update_affiliate_partners_updated_at
BEFORE UPDATE ON public.affiliate_partners
FOR EACH ROW
EXECUTE FUNCTION public.update_articles_updated_at();

CREATE TRIGGER update_data_sources_updated_at
BEFORE UPDATE ON public.data_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_articles_updated_at();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_articles_ai_status ON public.articles(ai_status);
CREATE INDEX IF NOT EXISTS idx_articles_is_affiliate ON public.articles(is_affiliate);
CREATE INDEX IF NOT EXISTS idx_articles_partner_id ON public.articles(partner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_article_id ON public.affiliate_clicks(article_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_clicked_at ON public.affiliate_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_sources_source_type ON public.data_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_data_sources_active ON public.data_sources(active);