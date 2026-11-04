
-- ============ 1. Roles system ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','editor','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- ============ 2. Helper to rewrite policies ============
-- affiliate_clicks: keep public insert, restrict select to admins
DROP POLICY IF EXISTS "Authenticated users can view affiliate clicks" ON public.affiliate_clicks;
CREATE POLICY "Admins can view affiliate clicks" ON public.affiliate_clicks
  FOR SELECT TO authenticated USING (public.is_admin());

-- affiliate_partners
DROP POLICY IF EXISTS "Authenticated users can manage affiliate partners" ON public.affiliate_partners;
CREATE POLICY "Admins manage affiliate partners" ON public.affiliate_partners
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- articles: keep public SELECT of published; admin manages
DROP POLICY IF EXISTS "Authenticated users can manage articles" ON public.articles;
CREATE POLICY "Admins manage articles" ON public.articles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- article_entities / relations / topics: keep public read, admin write
DROP POLICY IF EXISTS "Authenticated manage article_entities" ON public.article_entities;
CREATE POLICY "Admins manage article_entities" ON public.article_entities
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Authenticated manage article_relations" ON public.article_relations;
CREATE POLICY "Admins manage article_relations" ON public.article_relations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Authenticated manage article_topics" ON public.article_topics;
CREATE POLICY "Admins manage article_topics" ON public.article_topics
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- authors: keep public read, admin write
DROP POLICY IF EXISTS "authors_auth_write" ON public.authors;
CREATE POLICY "Admins manage authors" ON public.authors
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- content_assets
DROP POLICY IF EXISTS "content_assets_auth_write" ON public.content_assets;
CREATE POLICY "Admins manage content_assets" ON public.content_assets
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- datasets
DROP POLICY IF EXISTS "datasets_auth_write" ON public.datasets;
CREATE POLICY "Admins manage datasets" ON public.datasets
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- entities
DROP POLICY IF EXISTS "Authenticated manage entities" ON public.entities;
CREATE POLICY "Admins manage entities" ON public.entities
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- topics
DROP POLICY IF EXISTS "Authenticated manage topics" ON public.topics;
CREATE POLICY "Admins manage topics" ON public.topics
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- topic_relations
DROP POLICY IF EXISTS "Authenticated manage topic_relations" ON public.topic_relations;
CREATE POLICY "Admins manage topic_relations" ON public.topic_relations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- opportunities: restrict read + write to admins
DROP POLICY IF EXISTS "opportunities_auth_write" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_public_read" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities public read" ON public.opportunities;
CREATE POLICY "Admins read opportunities" ON public.opportunities
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage opportunities" ON public.opportunities
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- source_library
DROP POLICY IF EXISTS "source_library_auth_write" ON public.source_library;
CREATE POLICY "Admins manage source_library" ON public.source_library
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- system_logs: admin-only read + write
DROP POLICY IF EXISTS "Authenticated users can manage system logs" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_public_read" ON public.system_logs;
CREATE POLICY "Admins manage system logs" ON public.system_logs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- data_sources: admin-only write
DROP POLICY IF EXISTS "Authenticated users can manage data sources" ON public.data_sources;
CREATE POLICY "Admins manage data sources" ON public.data_sources
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- rss_feeds: admin-only write
DROP POLICY IF EXISTS "Authenticated users can manage rss feeds" ON public.rss_feeds;
DROP POLICY IF EXISTS "Authenticated manage rss_feeds" ON public.rss_feeds;
CREATE POLICY "Admins manage rss_feeds" ON public.rss_feeds
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- search_intents: restrict SELECT to admins (backlog is internal)
DROP POLICY IF EXISTS "search_intents_public_read" ON public.search_intents;
DROP POLICY IF EXISTS "search_intents public read" ON public.search_intents;
DROP POLICY IF EXISTS "search_intents_auth_write" ON public.search_intents;
CREATE POLICY "Admins read search_intents" ON public.search_intents
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage search_intents" ON public.search_intents
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
