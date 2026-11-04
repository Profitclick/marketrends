
-- Enum for intent types
DO $$ BEGIN
  CREATE TYPE public.search_intent_type AS ENUM ('informational','commercial','transactional','comparison');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.search_intent_status AS ENUM ('pending','queued','generating','published','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.search_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  intent_type public.search_intent_type NOT NULL DEFAULT 'informational',
  template TEXT NOT NULL,
  search_cluster TEXT,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  secondary_entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  priority_score NUMERIC NOT NULL DEFAULT 0,
  content_status public.search_intent_status NOT NULL DEFAULT 'pending',
  target_slug TEXT UNIQUE,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  is_pillar BOOLEAN NOT NULL DEFAULT false,
  pillar_intent_id UUID REFERENCES public.search_intents(id) ON DELETE SET NULL,
  geo_blocks JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.search_intents TO anon;
GRANT SELECT ON public.search_intents TO authenticated;
GRANT ALL ON public.search_intents TO service_role;

ALTER TABLE public.search_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_intents public read"
  ON public.search_intents FOR SELECT
  USING (true);

CREATE POLICY "search_intents service write"
  ON public.search_intents FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_search_intents_priority ON public.search_intents (priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_search_intents_status ON public.search_intents (content_status);
CREATE INDEX IF NOT EXISTS idx_search_intents_cluster ON public.search_intents (search_cluster);
CREATE INDEX IF NOT EXISTS idx_search_intents_topic ON public.search_intents (topic_id);
CREATE INDEX IF NOT EXISTS idx_search_intents_entity ON public.search_intents (entity_id);
CREATE INDEX IF NOT EXISTS idx_search_intents_template ON public.search_intents (template);

CREATE TRIGGER trg_search_intents_updated_at
  BEFORE UPDATE ON public.search_intents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
