CREATE TABLE public.gsc_sync_state (id boolean PRIMARY KEY DEFAULT true CHECK (id), target_url text NOT NULL DEFAULT 'https://marketrends.no/', selected_site_url text, status text NOT NULL DEFAULT 'WAITING_FOR_SELECTION', last_started_at timestamptz, last_completed_at timestamptz, latest_complete_date date, first_available_date date, error text, retry_after timestamptz, snapshot jsonb NOT NULL DEFAULT '{}');
GRANT SELECT ON public.gsc_sync_state TO authenticated; GRANT ALL ON public.gsc_sync_state TO service_role;
ALTER TABLE public.gsc_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY gsc_state_admin_read ON public.gsc_sync_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.gsc_daily_metrics (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, site_url text NOT NULL, date date NOT NULL, dataset text NOT NULL CHECK(dataset IN ('page','query')), page text NOT NULL, canonical_url text NOT NULL, query text NOT NULL DEFAULT '', clicks double precision NOT NULL CHECK(clicks>=0), impressions double precision NOT NULL CHECK(impressions>=0), ctr double precision NOT NULL CHECK(ctr>=0 AND ctr<=1), position double precision NOT NULL CHECK(position>=0), search_type text NOT NULL DEFAULT 'web', device text NOT NULL DEFAULT '', country text NOT NULL DEFAULT '', appearance text NOT NULL DEFAULT '', ingested_at timestamptz NOT NULL DEFAULT now(), UNIQUE(site_url,date,dataset,page,query,search_type,device,country,appearance));
GRANT SELECT ON public.gsc_daily_metrics TO authenticated; GRANT ALL ON public.gsc_daily_metrics TO service_role; GRANT USAGE,SELECT ON SEQUENCE public.gsc_daily_metrics_id_seq TO service_role;
ALTER TABLE public.gsc_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY gsc_metrics_admin_read ON public.gsc_daily_metrics FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX gsc_metrics_window ON public.gsc_daily_metrics(site_url,dataset,date,canonical_url);
CREATE TABLE public.gsc_ingestion_days (site_url text NOT NULL, date date NOT NULL, dataset text NOT NULL, status text NOT NULL, row_count integer NOT NULL, ingested_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(site_url,date,dataset));
GRANT SELECT ON public.gsc_ingestion_days TO authenticated; GRANT ALL ON public.gsc_ingestion_days TO service_role;
ALTER TABLE public.gsc_ingestion_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY gsc_days_admin_read ON public.gsc_ingestion_days FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.search_performance_signals (canonical_url text PRIMARY KEY, content_type text NOT NULL, mapping jsonb NOT NULL DEFAULT '{}', metrics jsonb NOT NULL DEFAULT '{}', recommendation jsonb NOT NULL DEFAULT '{}', refreshed_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.search_performance_signals TO authenticated; GRANT ALL ON public.search_performance_signals TO service_role;
ALTER TABLE public.search_performance_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY search_signals_admin_read ON public.search_performance_signals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.internal_link_runs (id boolean PRIMARY KEY DEFAULT true CHECK(id), cursor uuid, processed integer NOT NULL DEFAULT 0, complete boolean NOT NULL DEFAULT false, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz);
GRANT SELECT ON public.internal_link_runs TO authenticated; GRANT ALL ON public.internal_link_runs TO service_role;
ALTER TABLE public.internal_link_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY link_runs_admin_read ON public.internal_link_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.internal_link_queue (article_id uuid PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE, queued_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.internal_link_queue TO service_role;
ALTER TABLE public.internal_link_queue ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.enqueue_internal_link_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE aid uuid;
BEGIN
IF TG_TABLE_NAME='articles' THEN aid:=coalesce(NEW.id,OLD.id); ELSE aid:=coalesce(NEW.article_id,OLD.article_id); END IF;
IF EXISTS(SELECT 1 FROM articles WHERE id=aid) THEN INSERT INTO internal_link_queue(article_id) VALUES(aid) ON CONFLICT(article_id) DO UPDATE SET queued_at=now(); END IF;
RETURN coalesce(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_internal_link_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER phase7c_article_link_change AFTER INSERT OR UPDATE OF published,slug,updated_at ON public.articles FOR EACH ROW EXECUTE FUNCTION public.enqueue_internal_link_change();
CREATE TRIGGER phase7c_topic_link_change AFTER INSERT OR UPDATE OR DELETE ON public.article_topics FOR EACH ROW EXECUTE FUNCTION public.enqueue_internal_link_change();
CREATE TRIGGER phase7c_entity_link_change AFTER INSERT OR UPDATE OR DELETE ON public.article_entities FOR EACH ROW EXECUTE FUNCTION public.enqueue_internal_link_change();
CREATE TRIGGER phase7c_cluster_link_change AFTER INSERT OR UPDATE OR DELETE ON public.article_clusters FOR EACH ROW EXECUTE FUNCTION public.enqueue_internal_link_change();
CREATE OR REPLACE FUNCTION public.phase7c_link_batch(p_limit integer DEFAULT 250,p_reset boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE st internal_link_runs%ROWTYPE; ids uuid[]; slugs text[]; n integer; last_id uuid;
BEGIN
IF p_limit<1 OR p_limit>500 THEN RAISE EXCEPTION 'batch size must be 1..500'; END IF;
PERFORM pg_advisory_xact_lock(710703);
INSERT INTO internal_link_runs(id) VALUES(true) ON CONFLICT DO NOTHING;
IF p_reset THEN UPDATE internal_link_runs SET cursor=NULL,processed=0,complete=false,started_at=now(),completed_at=NULL WHERE id=true; END IF;
SELECT * INTO st FROM internal_link_runs WHERE id=true FOR UPDATE;
IF NOT st.complete THEN
SELECT array_agg(id ORDER BY id),array_agg(slug ORDER BY id) INTO ids,slugs FROM (SELECT id,slug FROM articles WHERE published=true AND (st.cursor IS NULL OR id>st.cursor) ORDER BY id LIMIT p_limit) a;
ELSE
SELECT array_agg(id ORDER BY id),array_agg(slug ORDER BY id) INTO ids,slugs FROM (SELECT a.id,a.slug FROM articles a JOIN internal_link_queue q ON q.article_id=a.id ORDER BY q.queued_at,a.id LIMIT p_limit) a;
END IF;
n:=coalesce(cardinality(ids),0);
IF n=0 THEN UPDATE internal_link_runs SET complete=true,completed_at=coalesce(completed_at,now()) WHERE id=true; RETURN jsonb_build_object('processed_batch',0,'complete',true,'processed_total',st.processed,'queued',(SELECT count(*) FROM internal_link_queue)); END IF;
DELETE FROM internal_links WHERE source_type='article' AND source_slug=ANY(slugs);
INSERT INTO internal_links(source_type,source_slug,target_type,target_slug,anchor,relevance_score)
SELECT DISTINCT 'article',a.slug,r.target_type,r.slug,r.anchor,r.score FROM articles a JOIN (
SELECT article_id,'topic'::text target_type,slug,name anchor,0.8 score FROM (SELECT at.article_id,t.slug,t.name,row_number() OVER(PARTITION BY at.article_id ORDER BY at.relevance_score DESC,t.id) rn FROM article_topics at JOIN topics t ON t.id=at.topic_id WHERE at.article_id=ANY(ids)) x WHERE rn<=5
UNION ALL
SELECT article_id,'entity',slug,name,0.7 FROM (SELECT ae.article_id,e.slug,e.name,row_number() OVER(PARTITION BY ae.article_id ORDER BY ae.mention_count DESC,e.id) rn FROM article_entities ae JOIN entities e ON e.id=ae.entity_id WHERE ae.article_id=ANY(ids)) x WHERE rn<=5
UNION ALL
SELECT ac.article_id,'cluster',cd.slug,cd.name,0.5 FROM article_clusters ac JOIN cluster_definitions cd ON cd.slug=ac.cluster_slug WHERE ac.article_id=ANY(ids)
) r ON r.article_id=a.id WHERE a.published=true AND a.id=ANY(ids)
ON CONFLICT(source_type,source_slug,target_type,target_slug) DO UPDATE SET anchor=excluded.anchor,relevance_score=excluded.relevance_score;
DELETE FROM internal_link_queue WHERE article_id=ANY(ids);
SELECT id INTO last_id FROM unnest(ids) id ORDER BY id DESC LIMIT 1;
UPDATE internal_link_runs SET cursor=CASE WHEN st.complete THEN cursor ELSE last_id END,processed=processed+n,complete=CASE WHEN st.complete THEN true ELSE NOT EXISTS(SELECT 1 FROM articles WHERE published=true AND id>last_id) END,completed_at=CASE WHEN NOT st.complete AND NOT EXISTS(SELECT 1 FROM articles WHERE published=true AND id>last_id) THEN now() ELSE completed_at END WHERE id=true;
RETURN jsonb_build_object('processed_batch',n,'processed_total',st.processed+n,'complete',(SELECT complete FROM internal_link_runs WHERE id=true),'queued',(SELECT count(*) FROM internal_link_queue));
END $$;
REVOKE ALL ON FUNCTION public.phase7c_link_batch(integer,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.phase7c_link_batch(integer,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.phase7c_map_urls(p_urls text[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH paths AS (SELECT url,regexp_replace(url,'^https://marketrends.no/?','') path FROM unnest(p_urls) url), mapped AS (
SELECT p.url,'article' type,a.id,a.slug,a.created_at,a.updated_at,a.editorial_authority_score authority,(SELECT coalesce(jsonb_agg(cluster_slug),'[]') FROM article_clusters WHERE article_id=a.id) clusters,(SELECT coalesce(jsonb_agg(topic_id),'[]') FROM article_topics WHERE article_id=a.id) topics,(SELECT coalesce(jsonb_agg(entity_id),'[]') FROM article_entities WHERE article_id=a.id) entities FROM paths p JOIN articles a ON a.slug=p.path AND a.published=true
UNION ALL SELECT p.url,'topic',t.id,t.slug,t.created_at,t.updated_at,t.authority_score,(SELECT coalesce(jsonb_agg(DISTINCT cluster_slug),'[]') FROM cluster_seed_nodes WHERE node_type='topic' AND node_id=t.id),jsonb_build_array(t.id),'[]'::jsonb FROM paths p JOIN topics t ON p.path='topic/'||t.slug
UNION ALL SELECT p.url,'entity',e.id,e.slug,e.created_at,e.updated_at,e.authority_score,(SELECT coalesce(jsonb_agg(DISTINCT cluster_slug),'[]') FROM cluster_seed_nodes WHERE node_type='entity' AND node_id=e.id),'[]',jsonb_build_array(e.id) FROM paths p JOIN entities e ON p.path='entity/'||e.slug
UNION ALL SELECT p.url,'cluster',NULL::uuid,c.slug,NULL::timestamptz,NULL::timestamptz,NULL::numeric,jsonb_build_array(c.slug),'[]','[]' FROM paths p JOIN cluster_definitions c ON p.path=c.slug
UNION ALL SELECT p.url,'knowledge',k.id,k.slug,k.created_at,k.updated_at,NULL::numeric,(SELECT coalesce(jsonb_agg(DISTINCT cluster_slug),'[]') FROM cluster_seed_nodes WHERE (node_type='topic' AND node_id=k.topic_id) OR (node_type='entity' AND node_id=k.entity_id)),CASE WHEN k.topic_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(k.topic_id) END,CASE WHEN k.entity_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(k.entity_id) END FROM paths p JOIN knowledge_pages k ON p.path='knowledge/'||k.slug AND k.published=true
UNION ALL SELECT p.url,'guide',g.id,g.slug,g.created_at,g.updated_at,NULL::numeric,'[]','[]','[]' FROM paths p JOIN guides g ON p.path='guide/'||g.slug AND g.published=true
UNION ALL SELECT p.url,'comparison',c.id,c.slug,c.created_at,c.updated_at,NULL::numeric,(SELECT coalesce(jsonb_agg(DISTINCT cluster_slug),'[]') FROM cluster_seed_nodes WHERE node_type='entity' AND node_id IN(c.entity_a_id,c.entity_b_id)),'[]',jsonb_build_array(c.entity_a_id,c.entity_b_id) FROM paths p JOIN comparison_pages c ON p.path='compare/'||c.slug AND c.published=true
UNION ALL SELECT p.url,'search_intent',s.id,s.target_slug,s.created_at,s.updated_at,NULL::numeric,(SELECT coalesce(jsonb_agg(cluster_slug),'[]') FROM article_clusters WHERE article_id=s.article_id),CASE WHEN s.topic_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(s.topic_id) END,CASE WHEN s.entity_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(s.entity_id) END FROM paths p JOIN search_intents s ON p.path='intent/'||s.target_slug AND s.content_status='published'
)
SELECT coalesce(jsonb_object_agg(url,jsonb_build_object('content_type',type,'content_id',id,'slug',slug,'publication_date',created_at,'updated_at',updated_at,'internal_authority',authority,'clusters',clusters,'topics',topics,'entities',entities)),'{}') FROM mapped;
$$;
REVOKE ALL ON FUNCTION public.phase7c_map_urls(text[]) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.phase7c_map_urls(text[]) TO service_role;