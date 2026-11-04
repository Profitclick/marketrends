CREATE TABLE public.cluster_definitions (
  slug text PRIMARY KEY,
  name text NOT NULL,
  supporting_categories text[] NOT NULL DEFAULT '{}',
  guide_categories text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cluster_definitions TO anon, authenticated;
GRANT ALL ON public.cluster_definitions TO service_role;
ALTER TABLE public.cluster_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cluster_definitions public read" ON public.cluster_definitions FOR SELECT USING (true);

CREATE TABLE public.cluster_seed_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_slug text NOT NULL REFERENCES public.cluster_definitions(slug) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN ('topic','entity')),
  node_id uuid NOT NULL,
  node_name text NOT NULL,
  strength text NOT NULL CHECK (strength IN ('strong','supporting')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster_slug, node_type, node_id)
);
GRANT SELECT ON public.cluster_seed_nodes TO anon, authenticated;
GRANT ALL ON public.cluster_seed_nodes TO service_role;
ALTER TABLE public.cluster_seed_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cluster_seed_nodes public read" ON public.cluster_seed_nodes FOR SELECT USING (true);
CREATE INDEX idx_cluster_seed_nodes_node ON public.cluster_seed_nodes(node_type, node_id);

CREATE TABLE public.article_clusters (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  cluster_slug text NOT NULL REFERENCES public.cluster_definitions(slug) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('TOPIC_MATCH','ENTITY_MATCH','MULTI_SIGNAL_MATCH')),
  matched_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, cluster_slug)
);
GRANT SELECT ON public.article_clusters TO anon, authenticated;
GRANT ALL ON public.article_clusters TO service_role;
ALTER TABLE public.article_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "article_clusters public read" ON public.article_clusters FOR SELECT USING (true);
CREATE INDEX idx_article_clusters_cluster ON public.article_clusters(cluster_slug, article_id);

-- Deterministic membership rule (preview, no writes).
-- Member iff: >=2 strong seeds, OR 1 strong + (supporting seed OR compatible editorial category),
-- OR >=2 supporting seeds + compatible editorial category. Category is never sufficient alone.
CREATE OR REPLACE FUNCTION public.preview_article_clusters()
RETURNS TABLE(article_id uuid, cluster_slug text, reason text, matched_refs jsonb, score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH hits AS (
    SELECT at.article_id, s.cluster_slug, s.node_type, s.node_name, s.strength
    FROM article_topics at JOIN cluster_seed_nodes s ON s.node_type='topic' AND s.node_id=at.topic_id
    UNION
    SELECT ae.article_id, s.cluster_slug, s.node_type, s.node_name, s.strength
    FROM article_entities ae JOIN cluster_seed_nodes s ON s.node_type='entity' AND s.node_id=ae.entity_id
  ), agg AS (
    SELECT h.article_id, h.cluster_slug,
      count(*) FILTER (WHERE strength='strong') AS strong_n,
      count(*) FILTER (WHERE strength='supporting') AS sup_n,
      bool_or(node_type='topic') AS has_topic,
      bool_or(node_type='entity') AS has_entity,
      jsonb_agg(jsonb_build_object('type',node_type,'name',node_name,'strength',strength)) AS refs
    FROM hits h GROUP BY 1,2
  )
  SELECT a.article_id, a.cluster_slug,
    CASE WHEN (a.has_topic AND a.has_entity) OR (cd.slug IS NOT NULL AND ar.category = ANY(cd.supporting_categories)) THEN 'MULTI_SIGNAL_MATCH'
         WHEN a.has_topic THEN 'TOPIC_MATCH' ELSE 'ENTITY_MATCH' END,
    a.refs || CASE WHEN ar.category = ANY(cd.supporting_categories)
                   THEN jsonb_build_array(jsonb_build_object('type','category','name',ar.category)) ELSE '[]'::jsonb END,
    (a.strong_n*2 + a.sup_n + CASE WHEN ar.category = ANY(cd.supporting_categories) THEN 1 ELSE 0 END)::numeric
  FROM agg a
  JOIN articles ar ON ar.id=a.article_id AND ar.published = true
  JOIN cluster_definitions cd ON cd.slug=a.cluster_slug
  WHERE a.strong_n >= 2
     OR (a.strong_n >= 1 AND (a.sup_n >= 1 OR ar.category = ANY(cd.supporting_categories)))
     OR (a.sup_n >= 2 AND ar.category = ANY(cd.supporting_categories));
$$;

CREATE OR REPLACE FUNCTION public.rebuild_article_clusters()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  DELETE FROM article_clusters WHERE true;
  INSERT INTO article_clusters(article_id, cluster_slug, reason, matched_refs, score)
  SELECT * FROM preview_article_clusters();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('memberships', n, 'rebuilt_at', now());
END $$;

REVOKE ALL ON FUNCTION public.preview_article_clusters() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_article_clusters() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_article_clusters() TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_article_clusters() TO service_role;

INSERT INTO public.cluster_definitions(slug,name,supporting_categories,guide_categories) VALUES
 ('ai','Kunstig intelligens',ARRAY['Teknologi & AI'],ARRAY['ai']),
 ('krypto','Kryptovaluta',ARRAY['Krypto & Trading'],ARRAY['krypto']),
 ('fintech','Fintech',ARRAY['Finans & Marked','Teknologi & AI'],ARRAY['fintech']),
 ('startup','Startup',ARRAY['Gründer & Startups'],ARRAY['entreprenørskap','saas','startup']),
 ('investering','Investering',ARRAY['Finans & Marked','Penger & Karriere'],ARRAY['investering']),
 ('daytrading','Daytrading',ARRAY['Krypto & Trading'],ARRAY['daytrading','trading']);