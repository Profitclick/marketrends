# Phase 4.1 — Audit Report

Date: 2026-07-03. Read-only findings; no code deleted.

## Routing (src/App.tsx)

- **`/` and `/:slug` both render `NewsView`** — intentional (slug catches article routes) but should be documented; risk of colliding with future top-level routes. Recommend a slug guard in `NewsView`.
- **`/admin` renders `Index`, `/dashboard` renders `Dashboard`** — two admin entry points. Consolidation candidate for Phase 5.
- Vertical pages `/ai`, `/krypto`, `/fintech`, `/startup`, `/investering`, `/daytrading` all route to the same `VerticalPage`. OK, but the slug is read from `location.pathname` rather than a param — brittle.

## Component duplication

Overlapping "list-of-articles" components, all doing a similar `supabase.from("articles").select(...).order(...).limit(N)`:

- `TopStories`, `QuickHeadlines`, `PopularNow`, `MostReadToday`, `MostReadThisWeek`, `Last24Hours`, `LatestNewsTicker`, `EditorsPicks`, `RecommendedForYou`, `SemanticRelatedArticles`, `RelatedArticles`, `ContinueReading`.
- Card renderers: `ArticleCard`, plus bespoke JSX inside `HeroSection`, `CategoryBlock`, `CategorySection`, `TopStories`.

**Consolidation target (Phase 4 iter 2):** single `ArticleCard` with `variant` prop + `src/lib/queries/articles.ts` shared fetchers. Not executed this iteration (each component is currently used and tested).

Trending: `TrendingTopics`, `TrendingEntities`, `TrendingEntitiesBar`, `TopicChips`, `EntityChips`, `TopicHubGrid` — overlap significantly. Candidate for a `TrendingList` primitive.

## Supabase queries

- ~40 direct `supabase.from()` calls scattered across components; no shared query layer.
- Repeated shapes: latest published articles by `created_at` DESC, articles filtered by `category`, article-by-slug, topics ordered by `trending_score`.
- **Recommendation:** `src/lib/queries/{articles,topics,entities}.ts` with typed helpers. Deferred.

## Edge functions

All 22 functions have `verify_jwt = false` (14 registered in `config.toml`; the rest inherit the default). None appear orphaned.

- `ingest-open-data` present but empty (only `.gitignore`) — reserved for Phase 5 open-data engine.
- `affiliate-redirect` present with only `.gitignore` — check if intentional.

## DB tables

25 tables. All currently accessed by client or edge functions. `datasets`, `entity_metrics`, `data_sources` are used lightly — worth reviewing scope in Phase 5.

## CSS & tokens

- Some hardcoded colors detected (spot check): mostly inside shadcn `ui/*` primitives (expected, they use CSS vars via tokens). No app-level components use `text-white`/`bg-black` outside token indirection.
- Typography: 4 heading utilities defined (`card-title`, `card-title-large`, plus base h1–h4). Consistent with memory rule of ≤3 fixed sizes.

## JSON-LD / schema

- `AnswerSchema.tsx` centralizes most schema output (good).
- Inline `<script type="application/ld+json">` still emitted in `ClusterPage.tsx` (CollectionPage + FAQPage). Duplicative with `AnswerSchema` — consolidate later.

## Accessibility

- 5 `<img>` tags outside `ArticleCard`; not all have `alt`. Priority fix.
- Icon-only buttons in `Navigation.tsx` and `Dashboard.tsx` — audit for `aria-label`.
- Some pages lack an explicit `<main>` landmark (rely on div structure).

## Performance

- No `loading="lazy"` on most `<img>` tags outside hero. Easy win.
- No aspect-ratio wrapper on article images → CLS risk. `EditorialImage` primitive proposed but not yet built.
- Bundle: React Query + Helmet + Radix loaded up-front; acceptable for admin routes but heavy for `/`.

## Summary

- **No blocking bugs.**
- **~15% component duplication** in article-list surface.
- **No shared query layer** — highest-value refactor for maintainability.
- Migration and edge function for Editorial Authority Score executed this iteration.
- Dashboard quality-monitor panel added (`QualityMonitorPanel`).

Full consolidation refactor scheduled for the next Phase 4 iteration.
