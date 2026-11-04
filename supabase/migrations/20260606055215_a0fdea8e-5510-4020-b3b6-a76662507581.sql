
-- Opportunities table: keyword/topic/entity opportunity tracking
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  category text,
  source text,
  search_intent text,
  trend_score numeric DEFAULT 0,
  momentum_score numeric DEFAULT 0,
  commercial_score numeric DEFAULT 0,
  competition_score numeric DEFAULT 0,
  search_volume integer DEFAULT 0,
  keyword_difficulty numeric DEFAULT 0,
  cpc_value numeric DEFAULT 0,
  search_demand_score numeric DEFAULT 0,
  coverage_score numeric DEFAULT 0,
  geo_priority numeric DEFAULT 0,
  opportunity_score numeric DEFAULT 0,
  recommended_content_type text,
  status text NOT NULL DEFAULT 'new',
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunities_public_read" ON public.opportunities FOR SELECT USING (true);
CREATE POLICY "opportunities_auth_write" ON public.opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER opportunities_touch BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX opportunities_score_idx ON public.opportunities(opportunity_score DESC);
CREATE INDEX opportunities_status_idx ON public.opportunities(status);
CREATE INDEX opportunities_category_idx ON public.opportunities(category);

-- Authors / editorial team
CREATE TABLE public.authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'author',
  title text,
  bio text,
  image_url text,
  expertise text[] DEFAULT '{}',
  social jsonb DEFAULT '{}'::jsonb,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.authors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authors TO authenticated;
GRANT ALL ON public.authors TO service_role;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authors_public_read" ON public.authors FOR SELECT USING (true);
CREATE POLICY "authors_auth_write" ON public.authors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER authors_touch BEFORE UPDATE ON public.authors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Content assets (reusable images/blocks/snippets linked to opportunities or articles)
CREATE TABLE public.content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL,
  title text,
  url text,
  body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_assets TO authenticated;
GRANT ALL ON public.content_assets TO service_role;
ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_assets_public_read" ON public.content_assets FOR SELECT USING (true);
CREATE POLICY "content_assets_auth_write" ON public.content_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER content_assets_touch BEFORE UPDATE ON public.content_assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Source library (citations, authoritative sources)
CREATE TABLE public.source_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text,
  source_type text,
  authority_score numeric DEFAULT 0,
  region text DEFAULT 'NO',
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.source_library TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_library TO authenticated;
GRANT ALL ON public.source_library TO service_role;
ALTER TABLE public.source_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "source_library_public_read" ON public.source_library FOR SELECT USING (true);
CREATE POLICY "source_library_auth_write" ON public.source_library FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER source_library_touch BEFORE UPDATE ON public.source_library FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Datasets (external data integrations: SSB, Norges Bank, CoinGecko, GSC, etc.)
CREATE TABLE public.datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text,
  dataset_key text,
  category text,
  url text,
  last_synced_at timestamptz,
  status text DEFAULT 'pending',
  payload jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.datasets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "datasets_public_read" ON public.datasets FOR SELECT USING (true);
CREATE POLICY "datasets_auth_write" ON public.datasets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER datasets_touch BEFORE UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add nullable editor + source_count to articles (backward compatible)
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS editor_slug text,
  ADD COLUMN IF NOT EXISTS author_slug text,
  ADD COLUMN IF NOT EXISTS source_count integer DEFAULT 0;
