
-- Knowledge engine tables
CREATE TABLE IF NOT EXISTS public.knowledge_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  category text,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  content text,
  summary text,
  faq_json jsonb DEFAULT '[]'::jsonb,
  key_takeaways_json jsonb DEFAULT '[]'::jsonb,
  schema_json jsonb,
  canonical_url text,
  meta_title text,
  meta_description text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_pages TO authenticated;
GRANT ALL ON public.knowledge_pages TO service_role;
ALTER TABLE public.knowledge_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_pages public read" ON public.knowledge_pages FOR SELECT USING (published = true);
CREATE POLICY "knowledge_pages service write" ON public.knowledge_pages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_knowledge_pages_topic ON public.knowledge_pages(topic_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_pages_entity ON public.knowledge_pages(entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_pages_category ON public.knowledge_pages(category);

CREATE TABLE IF NOT EXISTS public.comparison_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  entity_a text NOT NULL,
  entity_b text NOT NULL,
  entity_a_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  entity_b_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  content text,
  summary text,
  pros_cons_json jsonb DEFAULT '{}'::jsonb,
  faq_json jsonb DEFAULT '[]'::jsonb,
  schema_json jsonb,
  meta_title text,
  meta_description text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.comparison_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comparison_pages TO authenticated;
GRANT ALL ON public.comparison_pages TO service_role;
ALTER TABLE public.comparison_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comparison_pages public read" ON public.comparison_pages FOR SELECT USING (published = true);
CREATE POLICY "comparison_pages service write" ON public.comparison_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text,
  summary text,
  difficulty text DEFAULT 'beginner',
  estimated_read_time integer DEFAULT 5,
  category text,
  steps_json jsonb DEFAULT '[]'::jsonb,
  faq_json jsonb DEFAULT '[]'::jsonb,
  resources_json jsonb DEFAULT '[]'::jsonb,
  meta_title text,
  meta_description text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guides TO authenticated;
GRANT ALL ON public.guides TO service_role;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guides public read" ON public.guides FOR SELECT USING (published = true);
CREATE POLICY "guides service write" ON public.guides FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_guides_category ON public.guides(category);

-- Trend scores on topics + entities
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS velocity_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_score numeric DEFAULT 0;

ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS velocity_score numeric DEFAULT 0;

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_knowledge_updated ON public.knowledge_pages;
CREATE TRIGGER trg_knowledge_updated BEFORE UPDATE ON public.knowledge_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_comparison_updated ON public.comparison_pages;
CREATE TRIGGER trg_comparison_updated BEFORE UPDATE ON public.comparison_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_guides_updated ON public.guides;
CREATE TRIGGER trg_guides_updated BEFORE UPDATE ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
