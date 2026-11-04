
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS articles_last_7d integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS articles_last_30d integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hero_article_id uuid,
  ADD COLUMN IF NOT EXISTS explainer_article_id uuid;

CREATE INDEX IF NOT EXISTS idx_topics_trending_score ON public.topics(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_topics_articles_7d ON public.topics(articles_last_7d DESC);
CREATE INDEX IF NOT EXISTS idx_topics_category_hint ON public.topics(category_hint);

CREATE TABLE IF NOT EXISTS public.topic_relations (
  topic_id uuid NOT NULL,
  related_topic_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, related_topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_relations_topic_score ON public.topic_relations(topic_id, score DESC);

ALTER TABLE public.topic_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view topic_relations" ON public.topic_relations;
CREATE POLICY "Public can view topic_relations" ON public.topic_relations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated manage topic_relations" ON public.topic_relations;
CREATE POLICY "Authenticated manage topic_relations" ON public.topic_relations FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role manages topic_relations" ON public.topic_relations;
CREATE POLICY "Service role manages topic_relations" ON public.topic_relations FOR ALL USING (auth.role() = 'service_role');
