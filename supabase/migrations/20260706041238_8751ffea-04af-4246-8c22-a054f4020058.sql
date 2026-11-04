
ALTER TABLE public.search_intents
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commercial_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demand_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coverage_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS duplicate_of TEXT,
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_search_intents_quality ON public.search_intents (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_search_intents_pillar ON public.search_intents (pillar_intent_id);
