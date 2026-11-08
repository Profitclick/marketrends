-- Remove the legacy permissive write policy; the existing admin policy remains.
DROP POLICY IF EXISTS "Authenticated users can manage feeds" ON public.rss_feeds;
GRANT SELECT ON public.rss_feeds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rss_feeds TO authenticated;
GRANT ALL ON public.rss_feeds TO service_role;
ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;
COMMENT ON POLICY "Admins manage rss_feeds" ON public.rss_feeds IS 'Only database-backed admins may mutate feed configuration; scheduled service-role ingestion is unaffected.';