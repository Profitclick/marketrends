// Offline-verifiable, atomic audit checkpoint. No network access in this module.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const SITE = "https://marketrends.no";
const BASE = "a18137735307e92fb99c2f1116ea57a0925315c3";
const LEGACY = {
  artifact: 15043322801, revision: BASE,
  snapshot: "3e4cd3b4931f9918bf3136badf60c8a699435d212ca2abc0cf458c8b8f264d73",
  journal: "9afced587608953d7a437f36029f5e77569df16f87fa22050df1ab52285313a7",
};
const ALLOWED = new Set([
  "scripts/full-sitemap-ssr-audit.mjs", "scripts/full-sitemap-checkpoint.mjs",
  "scripts/full-sitemap-checkpoint.test.mjs", "docs/MIGRATE02_CHECKPOINT_RECOVERY.md",
]);
const AUDIT = "scripts/full-sitemap-ssr-audit.mjs";
const IMPORT = 'import { openCheckpoint, createCheckpoint, auditRevision, batchLimit } from "./full-sitemap-checkpoint.mjs";\n';
const SITEMAP = /^\/sitemap-(?:pages|articles-\d+|topics|entities|knowledge|guides|comparison)\.xml$/;
export const sha256 = value => createHash("sha256").update(value).digest("hex");
const check = (ok, message) => { if (!ok) throw Error("Checkpoint: " + message); };
export function auditRevision(legacy = false, cwd = process.cwd()) {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const head = git("rev-parse", "HEAD");
  check(!git("status", "--porcelain", "--untracked-files=no"), "tracked working tree is dirty");
  if (legacy) {
    git("merge-base", "--is-ancestor", BASE, head);
    const changed = git("diff", "--no-renames", "--name-only", BASE, head).split("\n").filter(Boolean);
    check(changed.every(file => ALLOWED.has(file)), "legacy runtime or test contract changed");
    const prefix = source => source.split("async function main() {")[0];
    check(prefix(git("show", `${BASE}:${AUDIT}`)) === prefix(git("show", `${head}:${AUDIT}`).replace(IMPORT, "")), "legacy evaluator changed");
  }
  return head;
}
export function batchLimit(value) {
  if (value === undefined) return 10000;
  check(/^[1-9]\d*$/.test(value) && Number(value) <= 10000, "invalid batch limit");
  return Number(value);
}
function url(value) {
  const u = new URL(value);
  check(u.origin === SITE && u.href === value && !u.hash && !u.username && !u.password, "invalid production URL");
  return u;
}
function kind(sitemap, value) {
  if (/^\/sitemap-articles-\d+\.xml$/.test(sitemap)) return "article";
  const parts = url(value).pathname.split("/").filter(Boolean);
  return parts.length > 1 ? parts[0] : sitemap === "/sitemap-pages.xml" ? "page" : sitemap.replace(/^\/sitemap-|\.xml$/g, "");
}
function validateSnapshot(raw) {
  const snapshot = JSON.parse(raw);
  check(Array.isArray(snapshot.entries) && snapshot.entries.length > 0 && snapshot.entries.length <= 10000, "invalid inventory size");
  check(Array.isArray(snapshot.duplicateUrls) && !snapshot.duplicateUrls.length, "duplicate snapshot URLs");
  check(Array.isArray(snapshot.sitemaps) && snapshot.sitemaps.length, "missing child sitemaps");
  const children = new Map(), entries = new Map();
  for (const child of snapshot.sitemaps) {
    const u = url(child.sitemap);
    check(SITEMAP.test(u.pathname) && !u.search && !children.has(u.pathname) && Number.isInteger(child.count) && child.count > 0 && /^[a-f0-9]{64}$/.test(child.sha256), "invalid child sitemap");
    children.set(u.pathname, { expected: child.count, actual: 0 });
  }
  for (const entry of snapshot.entries) {
    url(entry.url);
    check(!entries.has(entry.url) && children.has(entry.sitemap) && entry.kind === kind(entry.sitemap, entry.url), "invalid or duplicate inventory entry");
    entries.set(entry.url, entry);
    children.get(entry.sitemap).actual++;
  }
  check([...children.values()].every(c => c.expected === c.actual), "child inventory count mismatch");
  return { snapshot, entries };
}
function acceptRow(row, entries, latest) {
  const entry = entries.get(row.url);
  check(entry && row.kind === entry.kind && row.sitemap === entry.sitemap, "result outside inventory or wrong route");
  check(Array.isArray(row.issues) && row.issues.every(issue => typeof issue === "string" && issue.length > 0), "invalid issues");
  check(row.status === null || (Number.isInteger(row.status) && row.status >= 100 && row.status <= 599), "invalid HTTP status");
  check(row.issues.length || (row.status === 200 && row.canonical === row.url && typeof row.title === "string" && row.title.trim() && typeof row.h1 === "string" && row.h1.trim() && [row.ttfbMs, row.totalMs, row.bytes].every(n => Number.isFinite(n) && n >= 0)), "invalid PASS evidence");
  check(!latest.has(row.url) || latest.get(row.url).issues.length, "attempt after existing PASS");
  latest.set(row.url, row);
}
function replay(journal, entries) {
  check(typeof journal === "string" && (!journal || journal.endsWith("\n")), "incomplete journal");
  const latest = new Map();
  for (const line of journal.split("\n").slice(0, -1)) acceptRow(JSON.parse(line), entries, latest);
  return latest;
}
function atomic(file, data) {
  const temp = file + ".tmp";
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, file);
}
function attach(dir, raw, state, limit) {
  limit = batchLimit(String(limit));
  const { snapshot, entries } = validateSnapshot(raw);
  check(state.version === 1 && state.snapshotSha256 === sha256(raw) && state.journalSha256 === sha256(state.journal), "integrity mismatch");
  const latest = replay(state.journal, entries);
  const pending = [...snapshot.entries.filter(e => latest.get(e.url)?.issues.length), ...snapshot.entries.filter(e => !latest.has(e.url))].slice(0, limit);
  const permitted = new Set(pending.map(e => e.url));
  const persist = () => atomic(path.join(dir, "checkpoint.json"), JSON.stringify(state));
  return { snapshot, pending, latest: () => [...latest.values()],
    record(row) {
      check(permitted.has(row.url), "result not scheduled in this batch");
      const previous = latest.get(row.url);
      acceptRow(row, entries, latest);
      const journal = state.journal + JSON.stringify(row) + "\n";
      const next = { ...state, journal, journalSha256: sha256(journal) };
      try {
        atomic(path.join(dir, "checkpoint.json"), JSON.stringify(next));
      } catch (error) {
        if (previous) latest.set(row.url, previous); else latest.delete(row.url);
        throw error;
      }
      state = next;
      permitted.delete(row.url);
    },
    persist,
    exportResults() {
      atomic(path.join(dir, "results.jsonl"), [...latest.values()].map(r => JSON.stringify(r) + "\n").join(""));
      atomic(path.join(dir, "attempt-history.jsonl"), state.journal);
    },
  };
}
function initialize(dir, raw, journal, revision, legacy, limit) {
  fs.mkdirSync(dir, { recursive: true });
  check(!["snapshot.json", "checkpoint.json", "results.jsonl", "attempt-history.jsonl", "summary.json"].some(name => fs.existsSync(path.join(dir, name))), "output already contains audit evidence; explicit resume required");
  check(/^[a-f0-9]{40}$/.test(revision), "invalid revision");
  const state = { version: 1, revision, legacy, snapshotSha256: sha256(raw), journal, journalSha256: sha256(journal) };
  const checkpoint = attach(dir, raw, state, limit);
  fs.writeFileSync(path.join(dir, "snapshot.json"), raw, { flag: "wx" });
  checkpoint.persist();
  return checkpoint;
}
export function createCheckpoint(dir, snapshot, revision, limit) {
  return initialize(dir, JSON.stringify(snapshot, null, 2), "", revision, null, limit);
}
export function openCheckpoint({ dir, resume, legacyDir, revision, limit }) {
  check(/^[a-f0-9]{40}$/.test(revision), "invalid revision");
  check(!(resume && legacyDir), "resume and legacy import are mutually exclusive");
  if (legacyDir) {
    check(path.resolve(dir) !== path.resolve(legacyDir) && (!fs.existsSync(dir) || fs.realpathSync(dir) !== fs.realpathSync(legacyDir)), "legacy evidence must remain separate");
    const raw = fs.readFileSync(path.join(legacyDir, "snapshot.json"), "utf8");
    const journal = fs.readFileSync(path.join(legacyDir, "results.jsonl"), "utf8");
    check(sha256(raw) === LEGACY.snapshot && sha256(journal) === LEGACY.journal, "legacy artifact digest mismatch");
    return initialize(dir, raw, journal, revision, LEGACY, limit);
  }
  if (resume) {
    const raw = fs.readFileSync(path.join(dir, "snapshot.json"), "utf8");
    const state = JSON.parse(fs.readFileSync(path.join(dir, "checkpoint.json"), "utf8"));
    check(state.revision === revision, "revision mismatch; revalidation required");
    return attach(dir, raw, state, limit);
  }
  check(!["snapshot.json", "checkpoint.json", "results.jsonl", "attempt-history.jsonl", "summary.json"].some(name => fs.existsSync(path.join(dir, name))), "existing evidence requires explicit resume");
  return null;
}
