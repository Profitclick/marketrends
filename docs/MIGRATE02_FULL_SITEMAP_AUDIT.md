# MIGRATE-02.2 — full ordinary sitemap release audit

Baseline: 51a61a16ac048ed4ff51c7396b056868c703be3d (MIGRATE-02.1 regression green, run 45653194865).

The new gate freezes the locally generated ordinary sitemap inventory, then probes every unique URL exactly once through the isolated built SSR runtime. The production database remains the existing read-only public data source. No direct production page crawl, writes, auth credentials, DNS changes, activation or publishing.

- One in-flight HTTP request; at least 1,000 ms between request starts; 15-second deadline per request.
- Stops on HTTP 429/503, 3 consecutive transient errors or 10 cumulative transient errors. No automatic retries.
- Validates HTTP, one canonical, OG URL, robots, description, title, visible H1/main and article source/author/schema contract.
- Records per-URL timings, response sizes, failures, complete vs incomplete coverage, and snapshot hashes. Artifacts contain no raw HTML or credentials.
- The external Google News Worker is excluded from this ordinary sitemap inventory; it remains a separate production gate.
- Full scan runs only on an explicit [full-sitemap-audit] commit or manual dispatch with full_sitemap=true, after standard regression succeeds.
- Limits are conservative operational choices, not measurements of backend capacity. Local TTFB is diagnostic, not production performance.

No release approval until the actual complete report is reviewed. Authenticated admin/non-admin behavior and Lovable runtime parity remain separate gates.
