DROP POLICY IF EXISTS "Anyone can insert affiliate clicks" ON public.affiliate_clicks;
DROP POLICY IF EXISTS "content_assets_public_read" ON public.content_assets;
DROP POLICY IF EXISTS "newsletter public insert" ON public.newsletter_subscriptions;
CREATE POLICY "newsletter validated public insert" ON public.newsletter_subscriptions
FOR INSERT TO anon, authenticated
WITH CHECK (
  confirmed = false
  AND length(email) BETWEEN 5 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(category) BETWEEN 1 AND 64
  AND (source IS NULL OR length(source) <= 64)
);