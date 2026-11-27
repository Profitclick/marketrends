#!/usr/bin/env bash
# STDOUT is setup SQL for a fresh, disposable PostgreSQL with Supabase-role fixtures.
set -euo pipefail
cd "$(dirname "$0")/../../.."
cat <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
SQL
cat supabase/migrations/20251105140523_*.sql
# Include only the current relevant RLS sections. The other policy changes
# in that migration refer to unrelated tables outside this narrow fixture.
awk '/^-- ============ 2/{exit} {print}' supabase/migrations/20260709105135_*.sql
awk '/^-- articles:/{emit=1} /^-- article_entities/{emit=0} emit' supabase/migrations/20260709105135_*.sql
awk '/^-- rss_feeds:/{emit=1} /^-- search_intents:/{emit=0} emit' supabase/migrations/20260709105135_*.sql
awk '/^CREATE TABLE IF NOT EXISTS public.system_logs/{emit=1} /^-- ADD AFFILIATE FIELDS/{emit=0} emit' supabase/migrations/20251109044038_*.sql
cat supabase/migrations/20260807012848_*.sql
cat <<'SQL'
DELETE FROM public.rss_feeds;
INSERT INTO public.rss_feeds(id, name, url, active) VALUES
 ('00000000-0000-0000-0000-000000000001', 'Reuters A', 'https://feed-a.invalid/rss', true),
 ('00000000-0000-0000-0000-000000000002', 'Reuters B', 'https://feed-b.invalid/rss', true),
 ('00000000-0000-0000-0000-000000000003', 'Inactive', 'https://inactive.invalid/rss', false);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000010');
INSERT INTO public.user_roles(user_id, role) VALUES ('00000000-0000-0000-0000-000000000010', 'admin');
INSERT INTO public.articles(title, slug, category, content, source_url, source_name, published)
SELECT 'Fixture article', 'fixture-' || n, 'Fixture', 'Text',
       'https://catalog.invalid/story/' || n, 'Fixture', true
FROM generate_series(1, 50000) n;
INSERT INTO public.articles(title, slug, category, content, source_url, source_name, published) VALUES
 ('Published fixture', 'published-fixture', 'Fixture', 'Text', 'https://source.invalid/published', 'Fixture', true),
 ('Draft fixture', 'draft-fixture', 'Fixture', 'Text', 'https://source.invalid/draft', 'Fixture', false);
ANALYZE public.articles;
SQL
