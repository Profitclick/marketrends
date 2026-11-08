# Database recovery

## Phase 7D.2
- [x] Set only hourly job 6 to fetch_only, preserving 0 * * * *; scheduled-equivalent request 12950 succeeded, 7 feeds / 35 items, zero AI calls, creations or publications; all 7 last_fetched values advanced.
- [x] Migration 0012 restricts only start_pipeline_run/complete_pipeline_run to service_role and owner. Anonymous HTTP calls denied (42501); authenticated EXECUTE=false; existing service-role run tracking succeeded. Non-admin session test unavailable without an identified test account.
- [x] Correct stale Cloudflare architecture rule; current .env and 4 available historical versions contain only public/client-safe configuration. No secret rotation or environment changes.
- [x] Run 36 targeted tests successfully; automatic preview build OK and clean diff check. Return foundation report and stop.
- [ ] Frontend typecheck: `npm run typecheck` exists; manual run is prohibited in this environment. Only evidence: automatic preview build OK. Not asserted green.
- [x] Foundation audit pass 1 (8 Nov 2026): removed synthetic FAQPage from KeyTakeaways (question was invented, not visible Q&A); added `typecheck` and `test` npm scripts; marked retired apex Worker notes HISTORICAL. Tests 25/26 (admin RSS test needs admin session); eslint clean on touched paths. Typecheck script added but not run here (manual typecheck prohibited in this environment).
- [x] Foundation audit pass 2 (8 Nov 2026), verified: /academy, /tools, /trending, /newsletter added to sitemap-pages and prerendered with self-canonical; published /intent/:slug included (0 published today); /ressurser/:type prerendered with canonical /ressurser. Trial against live public data: 4,814 sitemap URLs, 4,820 files, missing=0, failed=0, 6 intentional non-sitemap variants; dashboard/admin/auth not written. Cluster leakage removed from PillarNav and generate-search-intent-page (now article_clusters). generate-search-intent-page now runs evergreenGuard before AI, supports dry_run with no writes, fails closed (deployed). Migration 0013 revoked anon/authenticated EXECUTE on 6 SECURITY DEFINER helpers (3 mutating); anon HTTP calls now 42501. RSS: only admin ALL + public active SELECT policy. Pipeline RPCs: anon/authenticated EXECUTE=false. Internal links: phase7c_link_batch bounded 1..500 with advisory lock + cursor; public read requires both endpoints public. Removed dead /forfatter/ author URL from NewsArticle schema; default share image now points to the existing site image (was missing /og-image.jpg); added public/logo.png referenced by Organization schema. Tests: scripts 27/28 (admin RSS test needs admin session), deno _shared+feeds 20/20. Lint: no new errors in touched files (PillarNav keeps 7 pre-existing no-explicit-any errors).

## Phase 7D.1
- [x] Normalize HTML-encoded article image URLs at ingestion and repair affected existing URLs without generation: 897 repaired, 0 encoded URLs remain; ingestion deployed.
- [x] Verify dashboard loads only on demand: existing React.lazy boundary and separate production chunk confirmed; browser requested no Dashboard module on public pages. No loading code change needed.
- [x] Remove duplicate sitewide JSON-LD while retaining route-specific schemas: homepage, vertical and article each have exactly one Organization and WebSite; NewsArticle/BreadcrumbList retained.
- [x] Run targeted tests and browser checks: 7 tests passed, repaired TU image loaded at natural width 1058, mobile has no horizontal overflow, no runtime errors, build OK. GSC and schedules untouched. Authenticated dashboard check unavailable because the requesting user has no matching auth account; signed-out redirect verified.

## Phase 7C.1
- [x] Reconcile the live news sitemap against exact eligible database slugs at a fixed audit timestamp.
- [x] Verify existing structured-data cleanup is already live; request republishing after fixing both critical access findings.
- [x] Restrict feed mutations to admins and public link reads to valid public endpoints; verify admin UI, 16 tests and fresh scan.
- [x] Phase 7C.2 COMPLETE; canonical-domain news-sitemap freshness blocker RESOLVED. Exact reconciliation against DB timestamp `2026-11-08T11:52:12.022229Z` (inclusive window starting `2026-11-06T11:52:12.022229Z`, published=true, no future dates, newest first, max 1,000): 75 eligible rows and 75 canonical live sitemap URLs; Missing=0, Stale=0, Duplicates=0, Drafts=0, Invalid canonical URLs=0, Backend URLs=0. Live canonical `/sitemap-news.xml`: HTTP 200, valid XML, `Content-Type: application/xml; charset=utf-8`, `X-Marketrends-News-Count: 75`, `X-Marketrends-Sitemap-Source: cloudflare-worker`, no `X-Deployment-Id`. Observed cache HIT had `Cache-Control: public, max-age=14400, s-maxage=600` (not the earlier max-age=0). Exact reconciliation passed; ongoing cache freshness across later publication boundaries is not asserted. Historical evidence:
  - DB snapshot 2026-11-08T09:41:18.837488Z: 80 eligible published articles in the inclusive rolling 48-hour window.
  - workers.dev endpoint of `marketrends-news-sitemap`: HTTP 200, valid XML, 80 URLs, `Cache-Control: public, max-age=0, s-maxage=600`, `X-Marketrends-News-Count: 80`, `X-Marketrends-Sitemap-Source: cloudflare-worker`.
  - Canonical `https://marketrends.no/sitemap-news.xml`: still Lovable static output — 84 URLs, `X-Deployment-Id` present, no Worker headers.
  - Public DNS resolves via Cloudflare anycast; NS `chip.ns.cloudflare.com` / `raquel.ns.cloudflare.com`.
  - HISTORICAL / RETIRED (do not restore): Worker route existed and apex was proxied, but even an isolated probe route did not execute. Broad route test rolled back; current route is narrow: `https://marketrends.no/sitemap-news.xml*`.
  - Worker source hardened externally (request-lifecycle cache write, diagnostic header, non-sitemap passthrough guard).
  - HISTORICAL / RETIRED (do not restore): apex Worker Custom Domain with `resolveOverride='lovable-origin.marketrends.no'` was rolled back after Cloudflare Error 1000. Current state: apex/www DNS-only A 185.158.133.1 direct to Lovable; Worker `marketrends-news-sitemap` isolated to custom domain news-sitemap.marketrends.no serving /sitemap-news.xml; no apex Worker Routes. Temporary edge-probe domain removed externally. No Cloudflare changes made in this closure.
  - Canonical closure gate passed at the fixed timestamp above; AGENTS.md updated only after reconciliation. GSC remains OBSERVATION_ONLY; no Phase 7D, generation, scheduler, database or deployment changes.

### Architecture documentation
- [x] Updated AGENTS.md after exact canonical reconciliation: ordinary sitemaps build-generated, canonical news sitemap dynamic, static artifact fallback only; existing index news entry unchanged.
- [x] Verify live structured data, exact before/after reconciliation, cost and unchanged schedules; return Phase 7C.1 NOT_COMPLETE report.

## Phase 7C
- [x] Audit current GSC access, sitemap freshness, metrics structures and scheduler without changing production jobs.
- [x] Add raw Google metrics, canonical content mapping and measured signals with early-data protection.
- [x] Add analysis-only recommendations and pillar coverage review; no generation or automatic publishing.
- [x] Resolve canonical-domain news sitemap freshness blocker — Phase 7C.2 exact canonical reconciliation passed at `2026-11-08T11:52:12.022229Z`.
- [x] Remove invalid SearchAction and Topic FAQ markup; reconcile internal links across the full corpus in bounded batches.
- [x] Validate safety, access, live results and return the specified Phase 7C report; full readiness blocked by sitemap delivery choice.

- [x] Repair authenticated news scheduling and verify a live no-AI collection run (fetch_only, 7 feeds, 35 items, 0 AI calls).
- [x] Seed canonical vocabulary + cluster seeds on the live database; deterministic pass over all published articles; rebuild clusters, internal links, authority.
- [ ] Restore historical records from the previous database — requires access to its exported records.
- [ ] Switch scheduler from fetch_only to full processing — forbidden until explicit bounded-publishing approval; available AI credits alone are insufficient.
- [ ] P1 AI enrichment of hybrid_pending/ai_required articles — waits on AI credits.
- [x] Connect marketrends.no — primary domain connected and serving the published site.
