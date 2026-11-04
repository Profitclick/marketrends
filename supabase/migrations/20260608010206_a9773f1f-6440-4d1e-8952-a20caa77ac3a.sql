CREATE TABLE public.internal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_slug text NOT NULL,
  target_type text NOT NULL,
  target_slug text NOT NULL,
  anchor text,
  relevance_score numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_slug, target_type, target_slug)
);
CREATE INDEX idx_internal_links_source ON public.internal_links (source_type, source_slug);
CREATE INDEX idx_internal_links_target ON public.internal_links (target_type, target_slug);

GRANT SELECT ON public.internal_links TO anon, authenticated;
GRANT ALL ON public.internal_links TO service_role;

ALTER TABLE public.internal_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read internal_links"
ON public.internal_links FOR SELECT
USING (true);

CREATE POLICY "Service role manages internal_links"
ON public.internal_links FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');