
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS key_facts jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS what_happened text,
  ADD COLUMN IF NOT EXISTS why_it_matters text,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image text,
  ADD COLUMN IF NOT EXISTS mentions_last_24h integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mentions_last_7d integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mentions_last_30d integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_mention_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_entities_trending ON public.entities (trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_entities_momentum ON public.entities (momentum_score DESC);
CREATE INDEX IF NOT EXISTS idx_entities_last_mention ON public.entities (last_mention_at DESC);
CREATE INDEX IF NOT EXISTS idx_entities_type ON public.entities (type);
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm ON public.entities USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.entity_relations (
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  related_entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  co_occurrence_count integer NOT NULL DEFAULT 1,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, related_entity_id),
  CHECK (entity_id <> related_entity_id)
);

GRANT SELECT ON public.entity_relations TO anon, authenticated;
GRANT ALL ON public.entity_relations TO service_role;

ALTER TABLE public.entity_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entity relations are publicly readable"
  ON public.entity_relations FOR SELECT
  USING (true);

CREATE POLICY "Service role manages entity relations"
  ON public.entity_relations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_entity_relations_score ON public.entity_relations (entity_id, score DESC);

CREATE TABLE IF NOT EXISTS public.entity_metrics (
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  day date NOT NULL,
  mentions integer NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_id, day)
);

GRANT SELECT ON public.entity_metrics TO anon, authenticated;
GRANT ALL ON public.entity_metrics TO service_role;

ALTER TABLE public.entity_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entity metrics are publicly readable"
  ON public.entity_metrics FOR SELECT
  USING (true);

CREATE POLICY "Service role manages entity metrics"
  ON public.entity_metrics FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_entity_metrics_day ON public.entity_metrics (day DESC);
