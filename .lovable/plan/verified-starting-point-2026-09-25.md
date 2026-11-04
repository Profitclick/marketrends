**Approved with the following constraints before execution:**

1. Editorial category may only be supporting evidence; never sufficient alone for cluster membership. Remove standalone `CATEGORY_MATCH` as a terminal membership reason.
2. Do not map guides/knowledge/comparisons back through broad editorial categories; prefer their canonical topic/entity relationships.
3. Enforce `UNIQUE(article_id, cluster_slug)` and proper foreign keys on the membership layer.
4. Run `rebuild_article_clusters()` in dry-run/preview mode first, report membership distribution and validation samples, then persist only after the rules pass validation.
5. Start without generic title-keyword fallback. Use existing canonical topic/entity relations first. Introduce title fallback only if measured under-classification justifies it, using a reviewed deterministic vocabulary.

With those changes, proceed with Phase 7A exactly as proposed. Keep mass generation paused and stop after the Phase 7A report.  
------------------  
Phase 7A — Category/Cluster Normalization + Authority Repair

Repair only. No AI calls, no new content, no node merges, mass generation stays paused, `articles.category` is not rewritten.

## Verified starting point

- Live published categories: Finans & Marked 2,425 · Krypto & Trading 1,776 · Teknologi & AI 1,172 · Trender & Analyse 364 · Gründer & Startups 144 · Penger & Karriere 21 · Analyse 11 (+ small remainder).
- Old English cluster codes (AI/Crypto/Fintech/Startups/Investing/Trading) are hardcoded in: `src/config/clusters.ts`, `compute-authority`, `build-internal-links`. `ClusterPage` filters `articles`, `guides`, `knowledge_pages`, `comparison_pages`, `opportunities` by these codes.
- `compute-opportunities` weights by the Norwegian categories (unaffected by cluster codes, but checked).
- Editorial category pages, Navigation, footer, feeds, image prompts, and ingestion use the Norwegian categories and stay unchanged.

## Steps

1. **Dependency list** — full grep plus a check of SQL functions/RPCs that filter by category; report it before any change.
2. **Protect downstream scoring** — read pg_cron state for compute-authority / compute-opportunities / compute-search-intents; temporarily set only the affected ones to inactive during the repair (reversible), re-enable after validation. orchestrate-search-intents and orchestrate-content stay paused.
3. **One canonical membership layer (database)**
  - `cluster_definitions` table: 6 clusters, each with a list of seed topic IDs, entity IDs, and compatible editorial categories — seeded from actual existing topics/entities (picked by querying names, reviewed before use), not invented keyword lists.
  - `article_clusters` table (article_id, cluster_slug, reason `TOPIC_MATCH`/`ENTITY_MATCH`/`CATEGORY_MATCH`/`MULTI_SIGNAL_MATCH`, matched_ref, score); multi-cluster allowed.
  - Rule: membership requires a topic or entity match; editorial category counts only as supporting evidence (e.g. "Gründer & Startups" for startup), never alone for broad categories. Keyword fallback only with a word-boundary match in the title plus a compatible category.
  - `rebuild_article_clusters()` SQL function (deterministic, idempotent) + a trigger-free batch call; public read on `article_clusters`, writes only for service role.
4. **Validate before downstream use** — 20 diverse samples per cluster, rated correct/incorrect/questionable from stored evidence; focus on fintech vs finance, investing vs macro, daytrading vs markets, startups vs large companies, AI vs general tech, crypto vs other trading. Tighten the seed lists if there are systematic false positives, then rebuild. Report the assigned / unassigned count (being unassigned is allowed).
5. **Switch the consumers to the layer**
  - `compute-authority`: cluster counts from `article_clusters` (articles, 7d, 30d, freshness, topics/entities represented); guides/knowledge/comparisons matched via cluster-mapped categories.
  - `build-internal-links`: cluster links from `article_clusters`; remove its local map.
  - `ClusterPage`: articles via a join on `article_clusters`; `src/config/clusters.ts` loses its `category` code field.
  - `compute-opportunities` / `compute-search-intents`: switch any cluster derivation from category to the layer.
6. **Recompute** — rebuild `cluster_stats` → run compute-authority (the only AI-free step); report per cluster: articles, 7d, 30d, topics, entities, guides, knowledge, comparisons, authority (labelled as an internal metric).
7. **Internal links** — measure before; verify the source; rebuild; measure after: total, cluster-targeted, self-links, broken targets, unpublished targets, duplicates.
8. **Frontend check** — Playwright for /ai, /krypto, /fintech, /startup, /investering, /daytrading (desktop + mobile): loads, relevant articles, no empty state, canonical correct.
9. **Regression** — homepage, category/topic/entity/article routes, ingestion, embeddings, deterministic enrichment, duplicate protection, scheduler authentication (cron runs in pipeline_runs). Re-enable the paused scoring jobs from step 2.
10. **Report** in exactly the format from the spec, with GREEN/YELLOW/RED and reasons. Stop afterwards.

## Technical details

- Migration: `cluster_definitions`, `article_clusters` (+ GRANT select to anon/authenticated, all to service_role, RLS read-only public), index on (cluster_slug, article_id), SECURITY DEFINER `rebuild_article_clusters()` with EXECUTE only for service_role.
- Seed IDs are inserted as data after review (not in the migration).
- Edge functions redeployed: compute-authority, build-internal-links, (compute-opportunities/compute-search-intents only if they derive clusters).
- Out of scope: topic_relations, graph convergence, merges, GSC, Opportunity redesign.