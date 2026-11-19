# A01 next-phase readiness

Status: PREPARED / NOT DEPLOYED

Prepared from production baseline commit `defc4f2414e2ed8245b8a6604a57c9d4cb7aee9b` on 2026-11-19.

This branch exists only to reduce risk before the next Lovable-credit window. It must not be treated as production remediation and must not be merged merely to make AUDIT-01 appear complete.

## Current production facts

AUDIT-01 remains blocked by HTTP transport behavior:

- Unknown public routes return HTTP 200 instead of a real 404.
- Invalid dynamic routes under `/kategori/:slug`, `/topic/:slug`, `/entity/:slug`, `/guide/:slug`, `/knowledge/:slug`, `/compare/:slug` and `/intent/:slug` return HTTP 200 instead of a real 404.
- Invalid `/cluster/:slug` returns HTTP 200 instead of a real 404.
- Valid legacy `/cluster/ai` resolves through client-side navigation instead of HTTP 301/308.
- `/admin`, `/auth` and `/dashboard` already have initial noindex,nofollow shells and no public canonical.
- Representative valid sitemap URLs currently deliver route-specific initial HTML with production self-canonicals.
- Arbitrary `/ressurser/:type` currently collapses to canonical `/ressurser`; this remains P1 observation, not a P0 blocker.

## Safety boundary

Until Lovable credits are available:

- no production publish
- no deploy
- no DNS or Cloudflare routing changes
- no database schema or data changes
- no scheduler changes
- no GSC changes
- no sitemap architecture changes
- no broad frontend refactor
- no manual SSR migration on main

The current production architecture remains apex DNS-only to Lovable, with the news sitemap Worker isolated to `news-sitemap.marketrends.no`.

## Readiness change on this branch

`scripts/seo-http-audit.mjs` is expanded to cover every known AUDIT-01 invalid dynamic route class.

It also accepts an optional preview origin:

```bash
MARKETRENDS_AUDIT_ORIGIN=https://<preview-host> node scripts/seo-http-audit.mjs
```

The script still requires canonical metadata to reference `https://marketrends.no`. This allows a Lovable preview to be tested without accepting preview-host canonical leakage.

The audit is read-only. It performs HTTP GET requests and writes only local audit evidence under `seo-audit/`.

## P0 acceptance contract

AUDIT-01 cannot close until raw HTTP responses satisfy all of these:

| Check | Required result |
|---|---|
| unknown top-level route | HTTP 404 |
| invalid `/kategori/:slug` | HTTP 404 |
| invalid `/topic/:slug` | HTTP 404 |
| invalid `/entity/:slug` | HTTP 404 |
| invalid `/guide/:slug` | HTTP 404 |
| invalid `/knowledge/:slug` | HTTP 404 |
| invalid `/compare/:slug` | HTTP 404 |
| invalid `/intent/:slug` | HTTP 404 |
| invalid `/cluster/:slug` | HTTP 404 |
| valid legacy `/cluster/ai` | HTTP 301 or 308 to `/ai` |
| `/admin`, `/auth`, `/dashboard` | HTTP 200, initial noindex,nofollow, no canonical |
| homepage | HTTP 200 with canonical `https://marketrends.no/` |
| sitemap index | HTTP 200 XML and references dedicated news sitemap Worker |
| valid sitemap routes | HTTP 200 with route-specific initial HTML and production canonical |

Hydrated React state is not sufficient evidence for any HTTP-status acceptance item.

## Next Lovable-credit window

Use Lovable's native migration/upgrade path in draft/preview only.

Required scope:

1. Upgrade the existing React/Vite application to a server-capable TanStack Start architecture.
2. Preserve current visual UI and public information architecture.
3. Preserve Lovable Cloud/PostgreSQL data and authentication behavior.
4. Preserve canonical host `https://marketrends.no`.
5. Preserve private-route protections and noindex behavior.
6. Implement server-side not-found handling for unknown and invalid dynamic resources.
7. Implement server-side permanent redirects for legacy cluster routes.
8. Do not publish.

After the preview is available:

```bash
MARKETRENDS_AUDIT_ORIGIN=https://<lovable-preview-host> node scripts/seo-http-audit.mjs
npm ci --no-audit --no-fund
npm run typecheck
npx tsc -p tsconfig.node.json --noEmit
npm run build
npm test
```

A migration is not eligible for publish if any existing valid public route loses route-specific HTML, canonical correctness, sitemap parity, auth isolation or build stability.

## Rollback rule

Before production publish, rollback means abandoning/reverting the Lovable draft/version. Production remains on the current React/Vite release.

After any future production publish, rollback must restore the last known-good production version if:

- any valid sitemap URL becomes a homepage fallback
- canonical host leaks to Lovable, Supabase or Worker hosts
- private routes become indexable
- auth/admin modules become publicly exposed
- sitemap parity fails
- unknown/invalid routes regress to indexable HTTP 200
- server redirects do not preserve the canonical destination

## Cost gate

No production migration is approved only because it fixes HTTP semantics. Before publish, verify both:

1. P0 correctness against the preview; and
2. observable Lovable runtime/hosting cost implications.

Do not invent a runtime cost estimate when actual metering is unavailable.

## Session log — 2026-11-19

Current holding state confirmed:

- Production remains unchanged on `main` commit `defc4f2414e2ed8245b8a6604a57c9d4cb7aee9b`.
- Readiness branch: `chore/a01-next-phase-readiness`.
- Readiness branch head at hold point: `2e338971930ab23308ef8bd6baf4d5c02046f233`.
- Branch contains only the expanded read-only HTTP audit and this readiness documentation.
- Lovable migration has not been started because credits are unavailable.
- No Lovable credits were intentionally consumed for migration work.
- No production publish/deploy, DNS, Cloudflare, database, scheduler, GSC or sitemap-architecture changes were made.
- AUDIT-01 remains open on the known P0 HTTP semantics: real 404 for unknown/invalid public routes and server-side permanent redirects for legacy cluster routes.
- Next action when Lovable credits return: native TanStack Start migration in draft/preview only, then run build/typecheck/tests, preview-targeted raw HTTP audit, canonical regression checks and cost gate before any publish decision.

Decision: keep production stable and do not add further workaround changes to the current static SPA while waiting for the next credit window.
