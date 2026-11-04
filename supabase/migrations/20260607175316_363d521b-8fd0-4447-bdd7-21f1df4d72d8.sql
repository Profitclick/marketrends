
-- 1. Authority scores
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS authority_score numeric DEFAULT 0;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS authority_score numeric DEFAULT 0;

-- 2. Cluster stats
CREATE TABLE IF NOT EXISTS public.cluster_stats (
  slug text PRIMARY KEY,
  name text,
  authority_score numeric DEFAULT 0,
  opportunity_score numeric DEFAULT 0,
  articles integer DEFAULT 0,
  guides integer DEFAULT 0,
  knowledge_pages integer DEFAULT 0,
  comparisons integer DEFAULT 0,
  internal_links integer DEFAULT 0,
  freshness_days numeric DEFAULT 0,
  momentum numeric DEFAULT 0,
  coverage_gap numeric DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cluster_stats TO anon, authenticated;
GRANT ALL ON public.cluster_stats TO service_role;
ALTER TABLE public.cluster_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cluster_stats public read" ON public.cluster_stats FOR SELECT USING (true);
CREATE POLICY "cluster_stats service write" ON public.cluster_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER cluster_stats_touch BEFORE UPDATE ON public.cluster_stats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Research reports
CREATE TABLE IF NOT EXISTS public.research_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text,
  body text,
  category text,
  authors text[] DEFAULT '{}',
  sources jsonb DEFAULT '[]'::jsonb,
  image_url text,
  published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.research_reports TO anon, authenticated;
GRANT ALL ON public.research_reports TO service_role;
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_reports public read" ON public.research_reports FOR SELECT USING (published = true);
CREATE POLICY "research_reports service write" ON public.research_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER research_reports_touch BEFORE UPDATE ON public.research_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Newsletter subscriptions
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  confirmed boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, category)
);
GRANT SELECT, INSERT ON public.newsletter_subscriptions TO anon, authenticated;
GRANT ALL ON public.newsletter_subscriptions TO service_role;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter public insert" ON public.newsletter_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "newsletter service all" ON public.newsletter_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Resource type tagging
ALTER TABLE public.source_library ADD COLUMN IF NOT EXISTS resource_type text;
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS resource_type text;
