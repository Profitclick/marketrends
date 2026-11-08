CREATE OR REPLACE FUNCTION public.is_public_link_endpoint(endpoint_type text, endpoint_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT CASE endpoint_type
 WHEN 'article' THEN EXISTS (SELECT 1 FROM public.articles WHERE slug = endpoint_slug AND published = true)
 WHEN 'topic' THEN EXISTS (SELECT 1 FROM public.topics WHERE slug = endpoint_slug)
 WHEN 'entity' THEN EXISTS (SELECT 1 FROM public.entities WHERE slug = endpoint_slug)
 WHEN 'cluster' THEN EXISTS (SELECT 1 FROM public.cluster_definitions WHERE slug = endpoint_slug)
 WHEN 'guide' THEN EXISTS (SELECT 1 FROM public.guides WHERE slug = endpoint_slug AND published = true)
 WHEN 'knowledge' THEN EXISTS (SELECT 1 FROM public.knowledge_pages WHERE slug = endpoint_slug AND published = true)
 WHEN 'comparison' THEN EXISTS (SELECT 1 FROM public.comparison_pages WHERE slug = endpoint_slug AND published = true)
 ELSE false END;
$$;
GRANT EXECUTE ON FUNCTION public.is_public_link_endpoint(text,text) TO anon, authenticated, service_role;
DROP POLICY IF EXISTS "Public read internal_links" ON public.internal_links;
CREATE POLICY "Public read published internal_links" ON public.internal_links FOR SELECT TO anon, authenticated
USING (public.is_public_link_endpoint(source_type, source_slug) AND public.is_public_link_endpoint(target_type, target_slug));
CREATE POLICY "Admins read all internal_links" ON public.internal_links FOR SELECT TO authenticated USING (public.is_admin());
GRANT SELECT ON public.internal_links TO anon, authenticated;
GRANT ALL ON public.internal_links TO service_role;
ALTER TABLE public.internal_links ENABLE ROW LEVEL SECURITY;