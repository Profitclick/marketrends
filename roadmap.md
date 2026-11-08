# Database recovery

## Phase 7C.1
- [x] Reconcile the live news sitemap against exact eligible database slugs at a fixed audit timestamp.
- [x] Verify existing structured-data cleanup is already live; request republishing after fixing both critical access findings.
- [x] Restrict feed mutations to admins and public link reads to valid public endpoints; verify admin UI, 16 tests and fresh scan.
- [ ] Implement automatic canonical news-sitemap delivery — no native route/partial refresh confirmed; Cloudflare has no existing Worker route, DNS inventory returned 403, and Cloudflare deployment is unsupported here.
- [x] Verify live structured data, exact before/after reconciliation, cost and unchanged schedules; return Phase 7C.1 NOT_COMPLETE report.

## Phase 7C
- [x] Audit current GSC access, sitemap freshness, metrics structures and scheduler without changing production jobs.
- [x] Add raw Google metrics, canonical content mapping and measured signals with early-data protection.
- [x] Add analysis-only recommendations and pillar coverage review; no generation or automatic publishing.
- [ ] Resolve canonical-domain news sitemap freshness between deployments; hosting capability/approved delivery method required.
- [x] Remove invalid SearchAction and Topic FAQ markup; reconcile internal links across the full corpus in bounded batches.
- [x] Validate safety, access, live results and return the specified Phase 7C report; full readiness blocked by sitemap delivery choice.

- [x] Repair authenticated news scheduling and verify a live no-AI collection run (fetch_only, 7 feeds, 35 items, 0 AI calls).
- [x] Seed canonical vocabulary + cluster seeds on the live database; deterministic pass over all published articles; rebuild clusters, internal links, authority.
- [ ] Restore historical records from the previous database — requires access to its exported records.
- [ ] Switch scheduler from fetch_only to full processing — waits on AI credits and explicit approval.
- [ ] P1 AI enrichment of hybrid_pending/ai_required articles — waits on AI credits.
- [x] Connect marketrends.no — primary domain connected and serving the published site.
