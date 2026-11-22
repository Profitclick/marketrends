# PREP-01 — TanStack migration readiness

Baseline: `bf732c09035b5676fa3183f9b60874276c7604a7`

Branch: `prep/01-tanstack-readiness`

Status: VALIDATED — NOT FOR PRODUCTION

## Scope completed

- Framework-neutral route outcomes for found / not_found / redirect.
- Framework-neutral, injected Supabase route loaders for:
  - homepage/article
  - category
  - topic
  - entity
  - guide
  - knowledge
  - comparison
  - search intent
- Legacy cluster resolution moved behind a framework-neutral resolver.
- Route metadata builders extracted from React components for the migrated route classes.
- Deterministic sitemap/private-route/prerender/404 orchestration extracted from Vite into `scripts/build-public-artifacts.mjs`.
- Existing Vite build continues to invoke the same artifact sequence through a thin plugin adapter.
- Added deterministic PREP tests for route outcomes, loader wiring, canonical metadata and portable build orchestration.

## Safety boundary

No production deploy or publish.
No DNS or Cloudflare changes.
No database schema/data or RLS changes.
No public URL changes.
No canonical-host changes.
No TanStack framework migration yet.
No removal of existing prerender/parity gates.

## Intended TanStack handoff

The later TanStack Start migration should translate route outcomes as follows:

- `status: "found"` -> return loader data
- `status: "not_found"` -> server `notFound()`
- `status: "redirect"` -> server permanent redirect using the supplied target/status code

Server route loaders should inject a server-safe Supabase client into the existing route data functions rather than reimplementing table/query policy.

Metadata should consume the existing pure metadata builders before replacing React Helmet wiring.

The public artifact pipeline should be invoked as an independent build step rather than re-embedding its policy in a framework lifecycle hook.

## Validation result

Validated on PREP code head `6155adede11930425eccd152b9859311f900cd1e` using temporary branch-only CI instrumentation, which has now been removed and the production CI workflow restored unchanged.

- app typecheck: PASS
- node/Vite typecheck: PASS
- PREP route-resolution tests: PASS
- PREP loader-wiring tests: PASS
- PREP build-pipeline tests: PASS
- deterministic full script test suite: PASS
- production-access test: PASS in the validation runner
- production build + sitemap/private-route/prerender/404 pipeline: PASS after one controlled rerun

The first full-build attempt reached a successful Vite compile and sitemap generation, then the prerender data source returned a transient `articles: HTTP 500`. Re-running the same build job on the same commit passed, so this was classified as an external transient data-source failure rather than a PREP code regression.

Global lint remains advisory/red because the repository already contains substantial pre-existing `no-explicit-any` debt. New PREP-specific explicit-`any` errors introduced during the refactor were removed before final validation.

## Existing CI baseline issue discovered

The production `main` CI is independently blocked before typecheck/build because `npm ci` reports that `package.json` and `package-lock.json` are out of sync. The missing lock entries reported by npm are:

- `@lovable.dev/vite-plugin-dev-server-bridge@1.3.3`
- `@lovable.dev/vite-plugin-hmr-gate@1.8.3`

PREP validation temporarily used `npm install --no-audit --no-fund` only to separate the PREP code result from this pre-existing lockfile issue. The branch workflow has been restored to match `main`; no production CI policy change is part of PREP-01.

The lockfile drift should be repaired separately before relying on `npm ci` as a green production gate.


## PREP-03 — corrected migration contracts

The free Lovable preflight surfaced several assumptions that were stronger than the actual branch state. PREP-03 closes the framework-neutral gaps without starting TanStack Start or changing current runtime behavior.

### Added

- `articleMetadata()` now exists as a pure metadata contract for article routes.
- `getAuthorForArticle(stableKey)` provides deterministic author selection for future SSR/hydration parity. It is additive only; current React rendering is not switched to it before the migration.
- `loadClusterRouteData()` now owns the canonical cluster/vertical query graph, including `cluster_definitions`, `cluster_seed_nodes`, the `article_clusters` membership join, related topics/entities/guides/knowledge/comparisons, and `cluster_stats`.
- `clusterMetadata()` now provides the pure canonical/CollectionPage/FAQ metadata contract for the six short vertical routes.
- `buildSitemapArtifacts()` separates deterministic sitemap generation from the legacy SPA-only private-shell/prerender/static-404 path.
- `npm run build:sitemaps` provides a strict sitemap-only entrypoint intended for the later server framework build.

### Intentionally not done outside Lovable

- No `@tanstack/react-start` packages or files.
- No server entry files.
- No file-based TanStack routes.
- No direct server Supabase client in route loaders.
- No `createServerFn` or Lovable runtime-specific server boundary.
- No replacement of React Router or React Helmet.
- No removal of the current SPA prerender/private-shell/static-404 pipeline.
- No current UI behavior change from random to deterministic article author selection.

### Correct future server-data boundary

The paid migration must not assume a TanStack route loader is server-only. The intended boundary is:

`TanStack route loader -> Lovable-supported TanStack server function / server boundary -> server-safe Supabase client -> existing routeData function`.

The exact server primitive and generated file shape remain Lovable/TanStack-runtime responsibilities and must be selected by the migration engine rather than pre-baked here.

### Build handoff

Current Vite behavior still calls `buildPublicArtifacts()` unchanged. During TanStack migration:

- keep `buildSitemapArtifacts()` / `generate-sitemaps.mjs`;
- retire the SPA-only physical prerender, private route shell and static 404 generators only after equivalent server HTTP/metadata gates pass;
- replace physical-file parity with sitemap-to-server-response HTTP/canonical parity.


### PREP-03 validation

Validated in GitHub Actions run `45069274623`:

- clean `npm ci`: PASS
- app typecheck: PASS
- node/Vite typecheck: PASS
- deterministic script suite: 77/77 PASS across 16 files
- production-access observation: 3 PASS, 1 environment-dependent/skipped-by-session condition
- Vite build: PASS
- sitemaps: 7 files, 4,477 articles, 0 news
- private shells: 3
- prerender: 5,282 routes; sitemap 5,276; missing 0; unexpected 6 allowed standalone routes
- static 404 generation: PASS

The temporary PREP-03 validation workflow is not part of the migration deliverable and is removed after validation.
