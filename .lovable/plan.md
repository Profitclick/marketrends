# Phase 7B — Production SEO surface + domain launch gate

Scope: make the existing site technically ready for https://marketrends.no before the domain is connected. No DNS changes, no mass generation, no archive restore, no AI enrichment, no redesign, no new content types.

## 0. Read-first audit (no changes)
- Verify each of the 7 known issues against current code (robots.txt confirmed still pointing at raw backend URLs; `/ai` and `/cluster/ai` both routed).
- Repo-wide search for `lovable.app`, `supabase.co/functions`, project ref, `http://marketrends.no`, `https://marketrends.no`; build an internal dependency map.

## 1–2. One public host + robots.txt
- Every canonical, og:url, JSON-LD, sitemap, RSS self-link uses `https://marketrends.no` (single constant).
- robots.txt: only `Sitemap: https://marketrends.no/sitemap-index.xml`; keep `/dashboard`, `/admin`, `/auth` disallowed; no backend IDs.

## 3–6. Public sitemaps under the canonical domain
- Hosting is a static site with no proxy/rewrite to backend functions. Smallest correct mechanism: generate sitemap files as static files at build time from the database (one generator, reusing existing sitemap logic), served at `https://marketrends.no/...`. Backend sitemap functions remain as internal sources, not advertised.
- Files: `sitemap-index.xml`, `sitemap-articles-N.xml` (sharded ≤ 45,000 URLs, 100% of published articles, no 1,000 cap), `sitemap-news.xml` (last 48 h, valid news tags, nb language, escaped XML, no duplicates), `sitemap-pages.xml` (home, six verticals, categories), plus topic/entity/knowledge/guide/compare/intent sitemaps only if they contain published content.
- Trade-off: static sitemaps refresh on each publish, not live. News sitemap freshness therefore depends on publish frequency — flagged in the report; a scheduled republish or proxy can come later.
- Report: published articles vs. URLs in sitemap, coverage %.

## 7–8. Cluster canonical URLs
- Canonical family: `/ai`, `/krypto`, `/fintech`, `/startup`, `/investering`, `/daytrading`.
- `/cluster/:slug` → client-side replace-redirect to `/:slug` (static hosting cannot issue a server 301; reported honestly). Internal links, breadcrumbs, JSON-LD and sitemap use only short URLs.
- Verify all six: load, title, description, canonical, CollectionPage schema, articles from `article_clusters`, no backend URLs.

## 9. Homepage category integrity
- Category blocks show only matching articles; fewer if fewer exist; hide the section when none. No unrelated fill-in. No layout changes.

## 10–13. Canonical + structured data validation
- Articles: canonical/og:url/NewsArticle/breadcrumb/share URL = `https://marketrends.no/{slug}`.
- Topic/entity/knowledge/guide/compare/intent: self-canonical, noindex for missing/unpublished.
- Remove FAQPage/HowTo where no visible content supports it; one Organization/WebSite definition.
- Playwright: raw HTML vs rendered DOM (title, canonical, description, JSON-LD) for home, article, topic, entity, cluster, guide. SPA kept; gaps reported, no SSR.

## 14–16. Static files, route matrix, redirects
- Align robots/sitemaps/llms.txt; strip internal operational/admin endpoints from llms.txt.
- Route matrix INDEX/NOINDEX/REDIRECT/PRIVATE for all public routes.
- Redirect policy: http→https and www→apex handled by Lovable domain setup (apex primary).

## 17–18. Domain + Search Console readiness (report only)
- DNS values: "DNS TARGET MUST BE OBTAINED FROM LOVABLE CUSTOM DOMAIN UI"; add both apex and www, apex primary, Cloudflare DNS-only.
- Submit `https://marketrends.no/sitemap-index.xml` in Search Console; verification pending (no fake tokens).

## Technical details
- Build-time generator: a Vite plugin/script reading published rows with the public key (RLS read access) and writing XML into the build output; existing `public/sitemap*.xml` and `news-sitemap.xml` replaced or removed to avoid two competing systems.
- `SITE_URL` in `src/config/site.ts` used everywhere; ClusterPage/VerticalPage canonicals point to the short route.
- Tests for: sitemap sharding (no URL lost, ≤ limit), news window filter, `/cluster/x` → `/x` mapping, category block never containing other categories.
- AGENTS.md: rule for public sitemap generation and canonical cluster URLs.
