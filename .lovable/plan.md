# Phase 7D — Full Production Foundation Audit (read-only)

## Goal
A full, evidence-based audit of the live marketrends.no covering all 27 sections in the brief. It ends with one readiness verdict, the top 10 highest-value actions, a proposed Phase 7D.1, production safety checks, and one final foundation decision. Nothing gets fixed in this phase.

## Hard limits
- No code changes, migrations, data writes, Cloudflare/DNS changes, scheduler changes or deploys.
- No AI generation or enrichment. GSC stays `OBSERVATION_ONLY`.
- The only exception is a P0 issue that endangers production right now. If one turns up, I stop, report it and ask before acting.
- Every claim is marked VERIFIED (with the command or query that shows it) or UNVERIFIED. No made-up metrics.
- Secrets are never printed.

## Workstreams (I'll run them in parallel where I can)
1. **Architecture, edge and routing (sections 1, 2, 10, 12):** DNS lookups and header checks on representative URLs (homepage, verticals, article, topic, entity, guide, comparison, `/cluster/:slug`, www, http, trailing slash, unknown slugs to test for soft 404s), Worker vs origin headers, cache-control, Googlebot user agents, and robots/meta robots. I can't read Cloudflare's dashboard settings (WAF, security level) from here, so those are marked UNVERIFIED unless the response headers show them.
2. **Frontend, images, performance (sections 3, 4, 18):** Playwright screenshots of the key page types at 1280, 889 and 390 widths. Measure overflow, CLS/LCP from the browser, image sizes and formats, missing width/height, lazy loading and broken images. Check JS/CSS bundle sizes and fonts from the production build output.
3. **Content and data (sections 5, 6, 8, 16, 17):** Read-only SQL on published-state integrity, duplicate slugs and titles, future timestamps, source attribution, how many feeds are active, stale or noisy, and when feeds last succeeded. Also cluster, topic and entity density, orphans, link counts and link integrity, unused tables, and missing indexes (via slow-query and index stats).
4. **Security (section 9):** Security scan plus database linter, review of RLS policies, SECURITY DEFINER functions and edge-function authorization (`verify_jwt` plus checks in the code), and a scan of the repository for secrets.
5. **AI, scheduler, cost (sections 7, 20, 21):** List every AI call in the edge functions (model, trigger, retries, guardrails) and classify each as ESSENTIAL, USEFUL, QUESTIONABLE or REMOVE. List the cron jobs and whether each is active, plus their actual run history. Review the AI gateway request log and credit usage.
6. **SEO, schema, AEO, sitemaps (sections 11, 13, 14, 15):** Fetch every child sitemap and check XML validity, counts, host, duplicates, lastmod, and sample them against the database. Extract JSON-LD from the rendered pages (NewsArticle, Breadcrumb, Organization) and audit titles, H1s and canonicals.
7. **Feedback loop and future design (sections 22–26):** Status of the GSC tables and data maturity, then a design for the bounded self-correcting engine (inputs, thresholds, rollback, audit trail) and how it lines up with commercial value. Prioritize by impact, risk, cost, effort and dependencies.

## Deliverable
- The full report saved as `/mnt/documents/Marketrends-Phase-7D-Foundation-Audit-2026-11-08.md`, with sections 1–27, findings rated CRITICAL/HIGH/MEDIUM/LOW, and supporting evidence.
- A short summary in chat with the readiness verdict, top 10 actions, the proposed Phase 7D.1 (not executed), the production safety checklist and the final decision.
- Optionally, a single line in `roadmap.md` noting that the audit was done, but only if you want that. By default I won't touch the repository.

## Technical notes
- Allowed tools: `curl`, `dig`, Playwright under /tmp, `supabase--read_query`, linter and security scan, edge function logs, AI gateway logs, and `rg` over the repository.
- Production bundle sizes come from the live asset responses, not a local build.
