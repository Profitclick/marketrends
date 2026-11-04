# Phase 4 — Iteration 1 Report

## Delivered

- **Audit report**: `.lovable/audit-phase4.md` — full read-only findings.
- **DB**: `articles.editorial_authority_score`, `authority_breakdown`, `last_scored_at` + index. Non-destructive.
- **Edge function**: `compute-editorial-authority` — scores 0–100 from sources, inbound links, topic/entity coverage, schema completeness, freshness, Norwegian relevance, readability. Reuses only existing DB signals.
- **Dashboard**: new `Kvalitet` tab (`QualityMonitorPanel`) with 4 sub-views:
  - Autoritet (score + trigger)
  - Foreldreløse (articles with 0 inbound links)
  - RSS-helse
  - Schema-dekning (ingress/KT/FAQ/kilder)

## Preserved

No existing routes, components, edge functions, DB tables, or RLS policies changed. Zero deletions.

## Remaining tech debt (Phase 5 candidates)

- Consolidate ~12 article-list components → single `ArticleCard` with variants + shared `src/lib/queries/articles.ts`.
- Consolidate trending components (`TrendingTopics`, `TrendingEntities`, `TrendingEntitiesBar`, `TopicChips`, `EntityChips`) into one primitive.
- Replace inline JSON-LD in `ClusterPage.tsx` with `AnswerSchema`.
- Build `<EditorialImage>` primitive with aspect-ratio + lazy loading; adopt across cards and hero.
- Add `<main>` landmark at layout level; audit icon-only buttons for `aria-label`.
- Consolidate `/admin` and `/dashboard` entry points.
- Fix slug-catchall route: guard `NewsView` against non-article top-level slugs.

## Phase 5 recommendations

- Editorial Pipeline v2 (RSS → popularity → verification → localisation → publish).
- Popularity Engine (RSS frequency, GDELT, Reddit/HN, GitHub Trending).
- Multi-source verification against the tiered source list.
- Modular Open Data providers (SSB, Norges Bank, Brønnøysund first) behind a common interface with retry/cache/rate-limit/health.
- Evergreen review scheduler (7/30/90/180 day).
- Editorial pipeline UI: publishing queue, AI processing queue, cost monitor.
