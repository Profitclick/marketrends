# Phase 8 — Production Readiness Report

Date: 2026-07-09
Scope: Honest, verified pass. No new features. No schema changes. No new edge functions.

## Files Modified This Pass
- `src/pages/NotFound.tsx` — rewritten to use design tokens (was `bg-gray-100`/`text-gray-600`/`text-blue-500` hardcoded colors), added `noindex`, uses `min-h-dvh`, primary button uses `bg-primary`, links via React Router.
- Bulk conversion: **17 files** — `min-h-screen` → `min-h-dvh` across every page (`Trending`, `GuidePage`, `CategoryPage`, `EntityPage`, `TopicPage`, `Tools`, `SearchIntentPage`, `About`, `Academy`, `ComparePage`, `NewsView`, `KnowledgePage`, `ArticleDetailView`, and loading/empty branches on Guide/Compare/Knowledge/Intent). Fixes mobile Safari toolbar viewport clipping (100vh includes chrome; 100dvh does not).

## Verified Clean
- **Dark-mode leakage**: only `src/components/ui/alert.tsx` and `src/components/ui/chart.tsx` retain `dark:` classes; both are shadcn primitives, harmless in light-only mode.
- **Hardcoded grays after fix**: only `ArticleHero.tsx` uses `text-gray-100`/`text-gray-300`, which is correct — text sits on top of a dark hero image overlay.
- **TypeScript**: `tsgo --noEmit` passes with no errors.
- **Sitemaps present**: `public/robots.txt`, `public/sitemap.xml`, `public/sitemap-index.xml` all exist; index references 6 edge-function sitemaps + the static fallback.
- **SEOHead** correctly emits Organization + Website + Breadcrumb + optional Article/FAQ JSON-LD, hreflang (`nb`/`no`/`x-default`), OG article tags, Twitter card, Norwegian geo tags.
- **Route lazy loading**: 21 of 22 non-critical routes are `React.lazy` with a Suspense fallback in `App.tsx`. Only `NewsView` (home LCP) is eagerly imported — correct.
- **Image attributes**: 18 files across the codebase set `loading` / `decoding` / `fetchpriority` on `<img>`. LCP hero image is `loading="eager"` + `fetchPriority="high"`.
- **PageShell** provides a single `<main id="main-content">` landmark plus skip-link; used on shell-standardized pages.

## Not Done This Pass (Honest)
- **Playwright 13-breakpoint visual sweep**: not run. Would require ~30 min of automation plus manual triage of each screenshot. Not attempted.
- **axe-core a11y sweep across all 22 routes**: not run.
- **Lighthouse before/after**: not measured. Any number I quote would be fabricated.
- **Duplicate-protection audit of edge functions** (`generate-knowledge-pages`, `generate-guides`, `generate-comparisons`, `generate-search-intent-page`, `orchestrate-*`): not opened this pass. Existing implementations were left untouched per "do not modify edge functions unless strictly required."
- **Mobile table→card refactor** for remaining panels (`ArticleModeration`, `CronJobMonitor`, `LinkGraphPanel` internals, `OpportunityCenter` full tables): not refactored this pass; they still rely on `overflow-x-auto` on <640px. `SearchIntentPanel` and `TopicHeatmap` were converted in Phase 8 Batch A.
- **SEO scanner run**: `seo_chat--trigger_scan` not triggered (requires user approval).

## Known Remaining Issues (Prioritized)
1. **Mobile tables** — 4 dashboard panels still horizontal-scroll on phones. Low user impact (admin-only), medium effort.
2. **`public/news-sitemap.xml`** — static file has an empty `<urlset>`; live news sitemap is served from the edge function `news-sitemap`. Static file is unreferenced by `sitemap-index.xml` and harmless, but could be removed for cleanliness.
3. **`ArticleHero`** uses hardcoded gray on dark hero — correct usage but worth documenting as an exception if you audit tokens later.
4. **No SSR** — `react-helmet` metadata updates client-side; non-JS crawlers (LinkedIn, Slack, Facebook) see only `index.html` head, not per-route OG tags. Fix requires stack change (out of Phase 8 scope).
5. **Unverified Lighthouse numbers** — no baseline captured.

## Production Readiness Score
**86 / 100** — up from ~85 pre-pass. Small improvement (viewport safety + NotFound polish + verified typecheck). The remaining 14 points are:
- 5 pts — mobile QA breakpoint sweep with evidence
- 4 pts — a11y sweep with axe + fixes
- 3 pts — Lighthouse measurement + LCP-verified improvements
- 2 pts — duplicate-protection audit of edge functions

## Estimated Scores (Not Measured)
Refusing to fabricate Lighthouse numbers. Deploy to preview and run PageSpeed Insights against `https://marketrends.lovable.app` for real values.

## Recommendation
Stop feature and polish work. Deploy, run Google PageSpeed + Search Console + `seo_chat--trigger_scan` against production, and let real data drive the next iteration — as the previous turn also recommended.
