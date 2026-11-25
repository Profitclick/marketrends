import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createCheckpoint, openCheckpoint, auditRevision, batchLimit, sha256 } from "./full-sitemap-checkpoint.mjs";
import { runAudit, evaluate, locs, decode } from "./full-sitemap-ssr-audit.mjs";
import { SITE_URL, NEWS_SITEMAP_URL, sitemapIndex, urlset } from "./sitemap-lib.mjs";

const revision = "a".repeat(40);
const origin = "http://127.0.0.1:3000";
const child = "/sitemap-pages.xml";
const entry = slug => ({ url: SITE_URL + "/" + slug, kind: "page", sitemap: child });
const snapshot = (...slugs) => ({ started: "2026-01-01T00:00:00.000Z", sitemaps: [{ sitemap: SITE_URL + child, count: slugs.length, sha256: "b".repeat(64) }], duplicateUrls: [], entries: slugs.map(entry) });
const pass = e => ({ ...e, status: 200, issues: [], canonical: e.url, title: "Test", h1: "Test", ttfbMs: 10, totalMs: 20, bytes: 200 });
const fail = e => ({ ...e, status: null, issues: ["FETCH_ERROR"], error: "Timeout" });
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marketrends-audit-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const read = (dir, name) => fs.readFileSync(path.join(dir, name), "utf8");
const write = (dir, name, contents) => fs.writeFileSync(path.join(dir, name), contents);
const resume = (dir, limit = 10) => openCheckpoint({ dir, resume: true, revision, limit });
function html(url) {
  return '<html><head><title>Test</title><link rel="canonical" href="' + url + '"><meta property="og:url" content="' + url + '"><meta name="description" content="Test"><meta name="robots" content="index, follow"><meta name="googlebot" content="index, follow"></head><body><main><h1>Test</h1></main></body></html>';
}
function fake(slugs, overrides = {}) {
  let clock = 0;
  const calls = [], starts = [];
  return { calls, starts, now: () => clock, sleep: async ms => { clock += ms; }, fetcher: async (url, options) => {
    assert.equal(new URL(url).origin, origin);
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal instanceof AbortSignal);
    const p = new URL(url).pathname;
    calls.push(p); starts.push(clock); clock += 10;
    if (Object.hasOwn(overrides, p)) return overrides[p]();
    if (p === "/sitemap-index.xml") return new Response(sitemapIndex([child.slice(1), NEWS_SITEMAP_URL]), { headers: { "content-type": "application/xml" } });
    if (p === child) return new Response(urlset(slugs.map(s => ({ path: "/" + s }))), { headers: { "content-type": "application/xml" } });
    return new Response(html(SITE_URL + p), { headers: { "content-type": "text/html" } });
  } };
}

test("strict batch bounds", () => {
  assert.equal(batchLimit(undefined), 10000);
  assert.equal(batchLimit("3"), 3);
  for (const bad of ["0", "-1", "1.5", "1e3", "10001", "", " 2"]) assert.throws(() => batchLimit(bad), /batch limit/);
});
test("partial checkpoint resumes failures first, keeps passes and attempt history", t => {
  const dir = temp(t), s = snapshot("a", "b", "c", "d");
  const c = createCheckpoint(dir, s, revision, 2);
  c.record(pass(s.entries[0])); c.record(fail(s.entries[1]));
  assert.throws(() => c.record(pass(s.entries[2])), /not scheduled/);
  const raw = read(dir, "snapshot.json");
  const r = resume(dir, 2);
  assert.deepEqual(r.pending.map(e => e.url), [s.entries[1].url, s.entries[2].url]);
  r.record(pass(s.entries[1])); r.record(pass(s.entries[2])); r.exportResults();
  assert.equal(read(dir, "snapshot.json"), raw);
  assert.equal(r.latest().length, 3);
  assert.equal(read(dir, "attempt-history.jsonl").trim().split("\n").length, 4);
  assert.equal(read(dir, "results.jsonl").trim().split("\n").length, 3);
  assert.equal(resume(dir).pending[0].url, s.entries[3].url);
});
test("invalid snapshot origins, duplicates, kinds and child counts fail closed", t => {
  for (const mutate of [s => s.entries[0].url = "https://example.com/a", s => s.entries.push(s.entries[0]), s => s.entries[0].kind = "article", s => s.sitemaps[0].count++, s => s.duplicateUrls.push(s.entries[0].url)]) {
    const s = snapshot("a"); mutate(s);
    assert.throws(() => createCheckpoint(temp(t), s, revision, 1), /Checkpoint:/);
  }
});
test("snapshot tampering, journal tampering and revision drift fail closed", t => {
  for (const mutate of [d => write(d, "snapshot.json", read(d, "snapshot.json") + " "), d => { const p = JSON.parse(read(d, "checkpoint.json")); p.journal += "{}\n"; write(d, "checkpoint.json", JSON.stringify(p)); }]) {
    const dir = temp(t); createCheckpoint(dir, snapshot("a"), revision, 1); mutate(dir);
    assert.throws(() => resume(dir), /integrity mismatch/);
  }
  const dir = temp(t); createCheckpoint(dir, snapshot("a"), revision, 1);
  assert.throws(() => openCheckpoint({ dir, resume: true, revision: "c".repeat(40), limit: 1 }), /revision mismatch/);
  assert.throws(() => openCheckpoint({ dir, revision, limit: 1 }), /explicit resume/);
});
test("even with matching digest, invalid rows and incomplete journals are rejected", t => {
  for (const journal of [JSON.stringify(pass(entry("outside"))) + "\n", JSON.stringify({ ...pass(entry("a")), canonical: "https://example.com/" }) + "\n", JSON.stringify(pass(entry("a"))) + "\n" + JSON.stringify(pass(entry("a"))) + "\n", "{}"] ) {
    const dir = temp(t); createCheckpoint(dir, snapshot("a"), revision, 1);
    const state = JSON.parse(read(dir, "checkpoint.json")); state.journal = journal; state.journalSha256 = sha256(journal); write(dir, "checkpoint.json", JSON.stringify(state));
    assert.throws(() => resume(dir), /Checkpoint:/);
  }
});
test("failed persistence cannot create a successful in-memory checkpoint", t => {
  const dir = temp(t), s = snapshot("a"), c = createCheckpoint(dir, s, revision, 1);
  fs.mkdirSync(path.join(dir, "checkpoint.json.tmp"));
  assert.throws(() => c.record(pass(s.entries[0])));
  assert.equal(c.latest().length, 0);
  assert.equal(resume(dir).pending.length, 1);
});
test("legacy import refuses unknown digests without modifying original evidence", t => {
  const legacyDir = temp(t), dir = temp(t);
  write(legacyDir, "snapshot.json", JSON.stringify(snapshot("a"))); write(legacyDir, "results.jsonl", "");
  assert.throws(() => openCheckpoint({ dir, legacyDir, revision, limit: 1 }), /digest mismatch/);
  assert.equal(read(legacyDir, "results.jsonl"), "");
  assert.throws(() => openCheckpoint({ dir: legacyDir, legacyDir, revision, limit: 1 }), /separate/);
});
test("fresh scan and resume use the same frozen inventory without repeating successful GETs", async t => {
  const dir = temp(t), first = fake(["a", "b", "c"]);
  const a = await runAudit({ origin, dir, revision, limit: 1, ...first });
  assert.deepEqual(first.calls, ["/sitemap-index.xml", child, "/a"]);
  assert.ok(first.starts.slice(1).every((v,i) => v - first.starts[i] >= 1000));
  assert.equal(a.complete, false); assert.equal(a.passed, 1); assert.equal(a.untested, 2);
  const second = fake(["changed"]);
  const b = await runAudit({ origin, dir, revision, resume: true, limit: 2, ...second });
  assert.deepEqual(second.calls, ["/b", "/c"]);
  assert.equal(b.complete, true); assert.equal(b.passed, 3); assert.equal(b.batchAttempted, 2);
  const third = fake([]);
  assert.equal((await runAudit({ origin, dir, revision, resume: true, limit: 1, ...third })).complete, true);
  assert.deepEqual(third.calls, []);
});
test("three consecutive timeouts stop the batch and preserve all failures", async t => {
  const dir = temp(t), timeout = () => { throw new DOMException("deadline", "TimeoutError"); };
  const f = fake(["a", "b", "c", "d"], { "/a": timeout, "/b": timeout, "/c": timeout });
  const s = await runAudit({ origin, dir, revision, ...f });
  assert.deepEqual(f.calls, ["/sitemap-index.xml", child, "/a", "/b", "/c"]);
  assert.equal(s.complete, false); assert.equal(s.failed, 3); assert.equal(s.untested, 1); assert.match(s.stopReason, /circuit breaker/);
  assert.ok(resume(dir).latest().every(r => r.errorName === "TimeoutError"));
});
test("ten nonconsecutive server errors stop the batch", async t => {
  const dir = temp(t), slugs = Array.from({ length: 22 }, (_, i) => String(i));
  const overrides = Object.fromEntries(slugs.filter((_,i) => i % 2 === 0).map(s => ["/" + s, () => new Response("error", { status: 500 })]));
  const s = await runAudit({ origin, dir, revision, ...fake(slugs, overrides) });
  assert.equal(s.transients, 10); assert.equal(s.batchAttempted, 19); assert.equal(s.complete, false);
});
test("429 and 503 stop immediately, even if body reading would fail", async t => {
  for (const status of [429,503]) {
    const f = fake(["a", "b"], { "/a": () => ({ status, headers: new Headers(), text() { throw Error("body timeout"); } }) });
    const s = await runAudit({ origin, dir: temp(t), revision, ...f });
    assert.equal(s.batchAttempted, 1); assert.equal(s.failed, 1); assert.equal(s.complete, false); assert.match(s.stopReason, new RegExp(String(status)));
  }
});
test("invalid origin, invalid resume and concurrent lock cause zero requests", async t => {
  const f = fake(["a"]), dir = temp(t);
  await assert.rejects(runAudit({ origin: SITE_URL, dir, revision, ...f }), /non-isolated/);
  await assert.rejects(runAudit({ origin, dir, revision, resume: true, ...f }));
  write(dir, "audit.lock", "held");
  await assert.rejects(runAudit({ origin, dir, revision, ...f }), /EEXIST/);
  assert.deepEqual(f.calls, []);
});
test("metadata evaluator still rejects noindex, duplicate canonical and serialized body markup", () => {
  const e = entry("a"), headers = new Headers({ "content-type": "text/html" });
  assert.deepEqual(evaluate(e, 200, headers, html(e.url)).issues, []);
  const broken = html(e.url).replace("index, follow", "noindex").replace("</head>", '<link rel="canonical" href="' + e.url + '"></head>').replace("<main><h1>Test</h1></main>", '<script>const x="<main><h1>Test</h1></main>"</script>');
  const issues = evaluate(e, 200, headers, broken).issues;
  for (const issue of ["ROBOTS_MISMATCH", "CANONICAL_MISMATCH", "MISSING_OR_ERROR_H1", "MISSING_MAIN"]) assert.ok(issues.includes(issue));
  assert.equal(decode("A &amp; B &#248;"), "A & B ø");
  assert.throws(() => locs("<urlset><url><lastmod>x</lastmod></url></urlset>", "urlset", "url"));
});
test("real Git revision check rejects a dirty tracked tree", t => {
  const dir = temp(t);
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "pipe", encoding: "utf8" }).trim();
  git("init", "-q"); git("config", "user.email", "fixture@example.invalid"); git("config", "user.name", "Fixture");
  write(dir, "tracked", "first"); git("add", "tracked"); git("commit", "-qm", "fixture");
  assert.equal(auditRevision(false, dir), git("rev-parse", "HEAD"));
  write(dir, "tracked", "changed"); assert.throws(() => auditRevision(false, dir), /dirty/);
});
test("explicit resume rechecks failed URLs without erasing earlier attempts", async t => {
  const dir = temp(t);
  const first = fake(["a", "b"], { "/a": () => new Response("not found", { status: 404 }) });
  const a = await runAudit({ origin, dir, revision, ...first });
  assert.equal(a.complete, false); assert.equal(a.failed, 1); assert.equal(a.passed, 1);
  const next = fake([]);
  const b = await runAudit({ origin, dir, revision, resume: true, limit: 1, ...next });
  assert.deepEqual(next.calls, ["/a"]); assert.equal(b.complete, true);
  const history = read(dir, "attempt-history.jsonl").trim().split("\n").map(JSON.parse);
  assert.deepEqual(history.map(r => r.status), [404, 200, 200]);
});
test("legacy output directory cannot be the original evidence directory", async t => {
  const dir = temp(t), f = fake([]);
  await assert.rejects(runAudit({ origin, dir, legacyDir: dir, revision, ...f }), /separate/);
  assert.deepEqual(fs.readdirSync(dir), []); assert.deepEqual(f.calls, []);
});
