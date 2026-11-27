import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { PGlite } from "npm:@electric-sql/pglite@0.6.0";

const migration = await Deno.readTextFile(new URL(
  "../migrations/20261127042841_editorial_candidate_registry.sql", import.meta.url,
));
const feed = "00000000-0000-0000-0000-000000000001";
const otherFeed = "00000000-0000-0000-0000-000000000002";
const firstRun = "10000000-0000-0000-0000-000000000001";
const secondRun = "10000000-0000-0000-0000-000000000002";
const job = "editorial-candidate-registry";

async function fixture(run: (db: PGlite) => Promise<void>) {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE public.articles (source_url text NOT NULL);
      CREATE TABLE public.rss_feeds (id uuid PRIMARY KEY, name text NOT NULL, active boolean);
      CREATE TABLE public.pipeline_runs (
        id uuid PRIMARY KEY, job_name text NOT NULL, status text NOT NULL DEFAULT 'running',
        started_at timestamptz NOT NULL, details jsonb NOT NULL DEFAULT '{}'
      );
      GRANT SELECT ON public.articles, public.rss_feeds, public.pipeline_runs TO service_role;
      GRANT UPDATE ON public.pipeline_runs TO service_role;
      INSERT INTO public.articles VALUES ('https://WWW.Source.test/old/?a=5&utm_campaign=mail');
      INSERT INTO public.rss_feeds VALUES ('${feed}', 'First', true), ('${otherFeed}', 'Second', true);
      INSERT INTO public.pipeline_runs (id, job_name, started_at) VALUES
        ('${firstRun}', '${job}', now() - interval '1 hour'), ('${secondRun}', '${job}', now());
    `);
    await db.exec(migration);
    await run(db);
  } finally {
    await db.close();
  }
}

const row = (source_url: string, fields = {}) => ({
  source_url, feed_id: feed, title: "A valid source title", pre_score: 0.63, evidence_chars: 915,
  published_at: "2020-01-01T00:00:00Z", ...fields,
});

async function ingest(db: PGlite, run: string, items: unknown[]) {
  return (await db.query<{ report: Record<string, unknown> }>(
    "SELECT public.record_editorial_candidate_batch($1, $2) AS report", [run, JSON.stringify(items)],
  )).rows[0].report;
}

Deno.test("SQL registry deduplicates, preserves provenance, and atomically records idempotent metrics", async () => {
  await fixture(async db => {
    await db.exec("SET ROLE service_role");
    const batch = [
      row("https://source.test/Story?part=1&amp;utm_source=rss"),
      row("http://www.source.test/Story/?part=1#g", { pre_score: 0.60 }),
      row("https://source.test/Story?part=1", { feed_id: otherFeed, pre_score: 0.40 }),
      row("https://source.test/Story?part=2"),
      row("https://source.test/old?a=5"),
      row("https://source.test/missing-title", { title: " " }),
      row("https://source.test/invalid-score", { pre_score: 1.01 }),
      row("https://source.test/invalid-time", { published_at: "infinity" }),
      row("https://source.test/insufficient", { evidence_chars: 799 }),
      row("https://source.test/below-score", { pre_score: 0.54 }),
      row("https://source.test/%2E%2e/item"),
    ];
    const result = await ingest(db, firstRun, batch);
    const { registry_batch_hash, ...summary } = result;
    assert(typeof registry_batch_hash === "string" && registry_batch_hash.length === 64);
    assertEquals(summary, {
      run_id: firstRun, rss_observations: 11, unique_source_articles: 8,
      new_candidates: 8, known_candidates: 0, qualified_candidates: 2, rejected_candidates: 6,
      unidentified_observations: { invalid_source_url: 1 }, ai_calls: 0, drafts_created: 0, published_articles: 0,
    });
    assertEquals(await ingest(db, firstRun, batch), result);
    await assertRejects(() => ingest(db, firstRun, batch.slice(1)), Error, "registry_batch_payload_changed");
    const advances = await ingest(db, secondRun, [row("https://source.test/Story?part=1")]);
    assertEquals([advances.new_candidates, advances.known_candidates, advances.qualified_candidates], [0, 1, 1]);
    const { rows } = await db.query(`
      SELECT o.feed_name, o.pre_score::text, o.occurrences, o.reason_code FROM public.editorial_candidate_observations o
      JOIN public.editorial_candidates c ON c.id = o.candidate_id
      WHERE c.source_key = 'source.test/Story?part=1' ORDER BY o.observed_at, o.feed_id`);
    assertEquals(rows, [
      { feed_name: "First", pre_score: "0.63", occurrences: 2, reason_code: "qualified" },
      { feed_name: "Second", pre_score: "0.4", occurrences: 1, reason_code: "below_pre_score" },
      { feed_name: "First", pre_score: "0.63", occurrences: 1, reason_code: "qualified" },
    ]);
    const { rows: status } = await db.query(`
      SELECT first_seen < last_seen AS history, reason_code FROM public.editorial_candidates
      WHERE source_key IN ('source.test/Story?part=1', 'source.test/old?a=5')
      ORDER BY source_key`);
    assertEquals(status, [{ history: true, reason_code: "qualified" }, { history: false, reason_code: "existing_article" }]);
  });
});

Deno.test("SQL rejects unsafe or failed batches and reserves only complete, fresh, unique selections", async () => {
  await fixture(async db => {
    await db.exec("SET ROLE service_role");
    await assertRejects(() => ingest(db, firstRun, [row("https://source.test/fail", { feed_id: firstRun })]),
      Error, "invalid_feed_provenance");
    await assertRejects(() => ingest(db, firstRun, Array(36).fill(row("https://source.test/fail"))),
      Error, "batch_limit_exceeded");
    await assertRejects(() => ingest(db, firstRun, [
      row("https://source.test/would-write"), row("https://source.test/bad-date", { published_at: "2026-25-01T00:00:00Z" }),
    ]), Error, "date/time field value out of range");
    assertEquals((await db.query("SELECT * FROM public.editorial_candidates")).rows, []);
    await ingest(db, firstRun, ["one", "two", "three"].map(slug => row("https://source.test/" + slug)));
    const { rows } = await db.query<{ id: string }>("SELECT id FROM public.editorial_candidates ORDER BY source_key");
    const ids = rows.map(r => r.id);
    await db.exec(`RESET ROLE; INSERT INTO public.articles VALUES ('https://source.test/two');
      SET ROLE service_role`);
    const claim = (selection: string[]) => db.query("SELECT * FROM public.claim_editorial_candidates($1)", [selection]);
    await assertRejects(() => claim(ids), Error, "invalid_candidate_selection");
    await assertRejects(() => claim([ids[0], ids[0]]), Error, "invalid_candidate_selection");
    await assertRejects(() => claim([ids[0], ids[2]]), Error, "candidate_not_claimable");
    const valid = [ids[1], ids[0]];
    assertEquals((await claim(valid)).rows.map(r => (r as { id: string }).id), valid);
    await assertRejects(() => claim(valid), Error, "candidate_not_claimable");
    await db.exec("RESET ROLE; SET ROLE authenticated");
    await assertRejects(() => db.query("SELECT * FROM public.editorial_candidates"), Error, "permission denied");
    await assertRejects(() => claim(valid), Error, "permission denied");
    await db.exec("RESET ROLE; SET ROLE anon");
    await assertRejects(() => db.query("SELECT * FROM public.editorial_candidate_observations"), Error, "permission denied");
    await assertRejects(() => db.query("SELECT public.prune_editorial_candidate_registry()"), Error, "permission denied");
  });
});

Deno.test("retention removes old evidence and preserves recent claims", async () => {
  await fixture(async db => {
    await ingest(db, firstRun, [row("https://source.test/expired"), row("https://source.test/claimed")]);
    await db.exec(`
      UPDATE public.editorial_candidate_observations SET observed_at = now() - interval '31 days';
      UPDATE public.editorial_candidates SET first_seen = now() - interval '32 days', last_seen = now() - interval '31 days';
      UPDATE public.editorial_candidates SET claimed_at = now() - interval '45 days' WHERE source_key LIKE '%/claimed';
      SET ROLE service_role;
    `);
    const { rows } = await db.query("SELECT public.prune_editorial_candidate_registry() AS removed");
    assertEquals(rows, [{ removed: { observations_removed: 2, candidates_removed: 1 } }]);
    assertEquals((await db.query("SELECT source_key FROM public.editorial_candidates")).rows, [{ source_key: "source.test/claimed" }]);
  });
});
