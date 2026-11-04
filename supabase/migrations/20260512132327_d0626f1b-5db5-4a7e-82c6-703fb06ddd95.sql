
-- Topics: hub pages for semantic clusters
CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  hero_entity_id uuid,
  category_hint text,
  article_count integer NOT NULL DEFAULT 0,
  last_article_at timestamptz,
  meta_title text,
  meta_description text,
  og_image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Entities: companies, people, cryptos, tech, products, startups
CREATE TABLE public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('company','person','crypto','tech','product','startup','other')),
  aliases text[] NOT NULL DEFAULT '{}',
  description text,
  wikidata_id text,
  mention_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topics
  ADD CONSTRAINT topics_hero_entity_fk FOREIGN KEY (hero_entity_id)
  REFERENCES public.entities(id) ON DELETE SET NULL;

-- M:N article ↔ topic
CREATE TABLE public.article_topics (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  relevance_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, topic_id)
);

-- M:N article ↔ entity
CREATE TABLE public.article_entities (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  mention_count integer NOT NULL DEFAULT 1,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, entity_id)
);

-- Precomputed related articles
CREATE TABLE public.article_relations (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  related_article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  similarity_score numeric NOT NULL DEFAULT 0,
  relation_type text NOT NULL DEFAULT 'mixed',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, related_article_id),
  CHECK (article_id <> related_article_id)
);

-- Indexes
CREATE INDEX idx_topics_article_count ON public.topics(article_count DESC);
CREATE INDEX idx_topics_last_article ON public.topics(last_article_at DESC NULLS LAST);
CREATE INDEX idx_entities_type ON public.entities(type);
CREATE INDEX idx_entities_mention_count ON public.entities(mention_count DESC);
CREATE INDEX idx_article_topics_topic ON public.article_topics(topic_id, relevance_score DESC);
CREATE INDEX idx_article_topics_article ON public.article_topics(article_id);
CREATE INDEX idx_article_entities_entity ON public.article_entities(entity_id);
CREATE INDEX idx_article_entities_article ON public.article_entities(article_id);
CREATE INDEX idx_article_relations_article ON public.article_relations(article_id, similarity_score DESC);

-- Enable RLS
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_relations ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public can view topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Public can view entities" ON public.entities FOR SELECT USING (true);
CREATE POLICY "Public can view article_topics" ON public.article_topics FOR SELECT USING (true);
CREATE POLICY "Public can view article_entities" ON public.article_entities FOR SELECT USING (true);
CREATE POLICY "Public can view article_relations" ON public.article_relations FOR SELECT USING (true);

-- Authenticated manage
CREATE POLICY "Authenticated manage topics" ON public.topics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated manage entities" ON public.entities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated manage article_topics" ON public.article_topics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated manage article_entities" ON public.article_entities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated manage article_relations" ON public.article_relations FOR ALL USING (auth.role() = 'authenticated');

-- Service role full access (edge functions use service role)
CREATE POLICY "Service role manages topics" ON public.topics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages entities" ON public.entities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages article_topics" ON public.article_topics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages article_entities" ON public.article_entities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages article_relations" ON public.article_relations FOR ALL USING (auth.role() = 'service_role');

-- Updated_at triggers
CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.update_articles_updated_at();
CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.update_articles_updated_at();
