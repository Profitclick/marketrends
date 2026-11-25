# MIGRATE-02.3A — checkpoint and bounded recovery

Baseline: `a18137735307e92fb99c2f1116ea57a0925315c3`, run `45654326351`, artifact `15043322801`.

The existing full sitemap audit now writes a frozen `snapshot.json` and an atomic, hash-checked `checkpoint.json` after each recorded attempt. `results.jsonl` is the latest result per URL; `attempt-history.jsonl` preserves all attempts. After a crash, the checkpoint is authoritative; result exports may lag. `audit.lock` prevents concurrent processes sharing an output directory. Never run recovery batches concurrently, including across different directories/runners. After an abnormal termination, verify that the previous process is stopped before removing a stale lock. The checkpoint protects against corruption, not an attacker able to rewrite files and recompute hashes; store it as trusted audit evidence.

## Offline tests (no dependencies or network)

```sh
node --check scripts/full-sitemap-checkpoint.mjs
node --check scripts/full-sitemap-ssr-audit.mjs
node --test scripts/full-sitemap-checkpoint.test.mjs
```

The normal fresh-snapshot CLI remains available with `MARKETRENDS_AUDIT_ORIGIN=http://127.0.0.1:3000`. A fresh run refuses to overwrite existing evidence. Explicit recovery requires a positive integer `MARKETRENDS_AUDIT_BATCH_LIMIT` (maximum 10000). No request is retried automatically within a batch; failed URLs precede untested ones on explicit resume. PASS rows are never re-requested within that checkpoint. Any incomplete coverage or unresolved failure exits nonzero. One request at a time, at least 1000 ms between starts, 15000 ms timeout, stop at HTTP 429/503, three consecutive or ten cumulative transient errors per batch.

## Authorized legacy diagnostic (do not run until separately approved)

Use a clean checkout of the recovery commit, with the baseline commit present in Git history (fetch full history if needed). Build/start the compatible isolated SSR runtime with the same public data access configuration. Verify the build and runtime separately. Extract the original artifact into a separate trusted directory and do not alter it. The CLI verifies the pinned snapshot and original journal digests, requires baseline ancestry, rejects tracked changes outside the four recovery files, and requires the original evaluator prefix to be unchanged. A later resume requires the exact same committed revision and a clean tracked tree.

```sh
MARKETRENDS_AUDIT_ORIGIN=http://127.0.0.1:3000 \
MARKETRENDS_AUDIT_LEGACY_DIR=/path/to/original/full-sitemap \
MARKETRENDS_AUDIT_OUTPUT=seo-audit/full-sitemap-recovery \
MARKETRENDS_AUDIT_BATCH_LIMIT=3 \
node scripts/full-sitemap-ssr-audit.mjs
```

Review the three diagnostic results before more load. To resume the resulting checkpoint after authorization, omit `MARKETRENDS_AUDIT_LEGACY_DIR` and set `MARKETRENDS_AUDIT_RESUME=1` with the same output directory and an explicit batch limit. Preserve the entire recovery directory between runs. The CI workflow itself is unchanged; legacy recovery requires artifact transfer, full Git history and explicit environment variables in a separately authorized run. The recovery commit uses `[skip ci]` to avoid starting database-dependent push jobs before review; this does not satisfy the normal regression gate.

A frozen inventory and compatible Git revision do not prove unchanged database contents, identical built runtime, or production availability. Reconcile current sitemap eligibility/content drift and confirm release parity before production approval. No automated main merge, deployment, DB/RLS changes, DNS changes or retries are authorized here.
