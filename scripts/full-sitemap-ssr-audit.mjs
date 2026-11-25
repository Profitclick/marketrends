// Bounded, one-pass GET audit of a frozen ordinary sitemap snapshot.
// This never browses production pages or the external news Worker directly.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { SITE_URL, NEWS_SITEMAP_URL } from "./sitemap-lib.mjs";

const LOCAL = "http://127.0.0.1:3000";
const OUTPUT = "seo-audit/full-sitemap";
const INTERVAL_MS = 1000;
const TIMEOUT_MS = 15000;
const MAX_TRANSIENT = 10;
const MAX_CONSECUTIVE_TRANSIENT = 3;
const MAX_URLS = 10000;

export function decode(value = "") {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (all, key) => {
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (key[0] !== "#") return named[key.toLowerCase()] ?? all;
    const cp = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : all;
  });
}

export function locs(xml, root, item) {
  if (!new RegExp("<" + root + "\\b[^>]*>[\\s\\S]*<\\/" + root + ">\\s*$", "i").test(xml))
    throw Error("Invalid XML root: " + root);
  const entries = [...xml.matchAll(new RegExp("<" + item + "\\b[^>]*>([\\s\\S]*?)<\\/" + item + ">", "gi"))];
  if (!entries.length) throw Error("Empty " + root);
  return entries.map(entry => {
    const matches = [...entry[1].matchAll(/<loc>([^<]+)<\/loc>/gi)];
    if (matches.length !== 1) throw Error("Expected exactly one loc in " + item);
    return decode(matches[0][1].trim());
  });
}

function attr(tag, name) {
  const m = tag.match(new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  return m ? decode(m[1] ?? m[2] ?? m[3]) : null;
}
function textOnly(s) {
  return decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
function exactProductionUrl(url) {
  const parsed = new URL(url);
  if (parsed.origin !== SITE_URL || parsed.hash || parsed.username || parsed.password || parsed.href !== url)
    throw Error("Unexpected URL: " + url);
  return parsed;
}
function kind(sitemap, url) {
  if (/^\/sitemap-articles-\d+\.xml$/.test(sitemap)) return "article";
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  if (segments.length > 1) return segments[0];
  return sitemap === "/sitemap-pages.xml" ? "page" : sitemap.replace(/^\/sitemap-|\.xml$/g, "");
}
function isIndexable(value) {
  const tokens = (value ?? "").toLowerCase().split(/[\s,;]+/);
  return !tokens.some(token => token === "noindex" || token === "none");
}
export function evaluate(entry, status, headers, html) {
  const issues = [];
  const expect = (ok, issue) => { if (!ok) issues.push(issue); };
  expect(status === 200, "HTTP_" + status);
  expect(/text\/html/i.test(headers.get("content-type") ?? ""), "NON_HTML");
  // Only inspect actual document head and visible markup, not serialized route data.
  const head = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) ?? [,""])[1];
  const body = ((html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i) ?? [,""])[1])
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const cleanHead = head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const links = [...cleanHead.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
  const metas = [...cleanHead.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  const canonicals = links.filter(tag => (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")).map(tag => attr(tag, "href"));
  const meta = name => metas.filter(tag => (attr(tag, "name") ?? "").toLowerCase() === name).map(tag => attr(tag, "content"));
  const og = name => metas.filter(tag => (attr(tag, "property") ?? "").toLowerCase() === name).map(tag => attr(tag, "content"));
  const title = textOnly((cleanHead.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? [,""])[1]);
  const h1 = textOnly((body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ?? [,""])[1]);
  expect(canonicals.length === 1 && canonicals[0] === entry.url, "CANONICAL_MISMATCH");
  expect(og("og:url").length === 1 && og("og:url")[0] === entry.url, "OG_URL_MISMATCH");
  expect(!!title, "MISSING_TITLE");
  expect(meta("description").some(value => !!value?.trim()), "MISSING_DESCRIPTION");
  expect(meta("robots").length === 1 && meta("robots").every(isIndexable), "ROBOTS_MISMATCH");
  expect(meta("googlebot").length === 1 && meta("googlebot").every(isIndexable), "GOOGLEBOT_MISMATCH");
  expect(isIndexable(headers.get("x-robots-tag")), "X_ROBOTS_NOINDEX");
  expect(!!h1 && !/^(siden finnes ikke|siden kunne ikke lastes|.+ ikke funnet)$/i.test(h1), "MISSING_OR_ERROR_H1");
  expect(/<main\b/i.test(body), "MISSING_MAIN");

  const schemas = [];
  for (const match of head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attr("<script " + match[1] + ">", "type") !== "application/ld+json") continue;
    try {
      const data = JSON.parse(match[2]);
      schemas.push(...(Array.isArray(data) ? data : data["@graph"] ?? [data]));
    } catch { issues.push("INVALID_JSON_LD"); }
  }
  if (entry.kind === "article" && status === 200) {
    const articles = schemas.filter(s => s?.["@type"] === "NewsArticle");
    const article = articles[0];
    expect(articles.length === 1, "ARTICLE_SCHEMA_COUNT");
    expect(article?.mainEntityOfPage?.["@id"] === entry.url, "ARTICLE_SCHEMA_CANONICAL");
    expect(article?.author?.["@type"] === "Organization" && article?.author?.name === "Marketrends.no", "ARTICLE_AUTHOR");
    expect(typeof article?.isBasedOn === "string" && /^https?:\/\//i.test(article.isBasedOn), "ARTICLE_SOURCE_SCHEMA");
    const anchors = [...body.matchAll(/<a\b[^>]*>/gi)].map(m => attr(m[0], "href"));
    expect(!!article?.isBasedOn && anchors.includes(article.isBasedOn), "ARTICLE_SOURCE_LINK");
    expect(/<article\b/i.test(body), "MISSING_ARTICLE_BODY");
    expect(!!article?.headline && h1.startsWith(article.headline), "ARTICLE_HEADLINE_MISMATCH");
  }
  return { issues: [...new Set(issues)], title, h1, canonical: canonicals[0] ?? null };
}

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];
}

async function main() {
  if (process.env.MARKETRENDS_AUDIT_ORIGIN !== LOCAL) throw Error("Refusing non-isolated origin");
  fs.mkdirSync(OUTPUT, { recursive: true });
  const started = new Date().toISOString();
  const rows = [], entries = [], sitemaps = [], seen = new Set(), duplicateUrls = [];
  let stopReason = null, lastStart = 0, consecutive = 0, transients = 0;
  const resultPath = OUTPUT + "/results.jsonl";
  fs.writeFileSync(resultPath, "");
  async function get(path) {
    const wait = INTERVAL_MS - (performance.now() - lastStart);
    if (wait > 0) await delay(wait);
    lastStart = performance.now();
    const response = await fetch(LOCAL + path, {
      redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "MarketrendsIsolatedReleaseAudit/1.0", accept: "text/html,application/xml,text/xml" },
    });
    const ttfbMs = Math.round(performance.now() - lastStart);
    const body = await response.text();
    return { response, body, ttfbMs, totalMs: Math.round(performance.now() - lastStart), bytes: Buffer.byteLength(body) };
  }
  async function xml(path) {
    const r = await get(path);
    if (r.response.status !== 200 || !/xml/i.test(r.response.headers.get("content-type") ?? "")) throw Error("Sitemap fetch failed: " + path + " HTTP " + r.response.status);
    return r.body;
  }
  try {
    const index = await xml("/sitemap-index.xml");
    const indexLocs = locs(index, "sitemapindex", "sitemap");
    if (indexLocs.filter(url => url === NEWS_SITEMAP_URL).length !== 1) throw Error("Expected exactly one dedicated news sitemap");
    if (new Set(indexLocs).size !== indexLocs.length) throw Error("Duplicate child sitemap");
    for (const sitemap of indexLocs) {
      if (sitemap === NEWS_SITEMAP_URL) continue;
      const u = exactProductionUrl(sitemap);
      if (!/^\/sitemap-(?:pages|articles-\d+|topics|entities|knowledge|guides|comparison)\.xml$/.test(u.pathname) || u.search) throw Error("Unexpected child sitemap: " + sitemap);
      const doc = await xml(u.pathname);
      const urls = locs(doc, "urlset", "url");
      sitemaps.push({ sitemap, count: urls.length, sha256: createHash("sha256").update(doc).digest("hex") });
      for (const url of urls) {
        exactProductionUrl(url);
        if (seen.has(url)) { duplicateUrls.push(url); continue; }
        seen.add(url);
        entries.push({ url, sitemap: u.pathname, kind: kind(u.pathname, url) });
      }
    }
    if (!entries.length || entries.length > MAX_URLS) throw Error("Unexpected snapshot size: " + entries.length);
    // Validate every non-article sitemap first, but include an article in the pilot.
    const firstArticle = entries.find(entry => entry.kind === "article");
    const ordered = [
      ...entries.filter(entry => entry.kind === "page" || entry.kind === "kategori" || entry.kind === "intent"),
      ...(firstArticle ? [firstArticle] : []),
      ...entries.filter(entry => !["article","page","kategori","intent"].includes(entry.kind)),
      ...entries.filter(entry => entry.kind === "article" && entry !== firstArticle),
    ];
    fs.writeFileSync(OUTPUT + "/snapshot.json", JSON.stringify({ started, sitemaps, duplicateUrls, entries: ordered }, null, 2));
    console.log("Frozen snapshot: " + entries.length + " unique URLs; " + sitemaps.length + " ordinary child sitemaps; external news Worker excluded.");
    for (const entry of ordered) {
      let row;
      try {
        const u = exactProductionUrl(entry.url);
        const r = await get(u.pathname + u.search);
        row = { ...entry, status: r.response.status, ttfbMs: r.ttfbMs, totalMs: r.totalMs, bytes: r.bytes, ...evaluate(entry, r.response.status, r.response.headers, r.body) };
      } catch (error) {
        row = { ...entry, status: null, issues: ["FETCH_ERROR"], error: String(error.message ?? error) };
      }
      rows.push(row);
      fs.appendFileSync(resultPath, JSON.stringify(row) + "\n");
      if (row.status === 429 || row.status === 503) { stopReason = "Rate-limit or unavailable response: HTTP " + row.status; break; }
      const transient = row.status === null || row.status >= 500;
      consecutive = transient ? consecutive + 1 : 0;
      if (transient) transients++;
      if (consecutive >= MAX_CONSECUTIVE_TRANSIENT || transients >= MAX_TRANSIENT) { stopReason = "Transient failure circuit breaker"; break; }
      if (rows.length % 100 === 0) console.log("Progress " + rows.length + "/" + ordered.length + "; failed " + rows.filter(r => r.issues.length).length);
    }
  } catch (error) { stopReason = String(error.message ?? error); }
  const failed = rows.filter(row => row.issues.length);
  const counts = {};
  for (const row of rows) {
    const c = counts[row.kind] ??= { attempted: 0, passed: 0, failed: 0, ttfb: [], total: [], bytes: [] };
    c.attempted++;
    c[row.issues.length ? "failed" : "passed"]++;
    if (Number.isFinite(row.ttfbMs)) c.ttfb.push(row.ttfbMs);
    if (Number.isFinite(row.totalMs)) c.total.push(row.totalMs);
    if (Number.isFinite(row.bytes)) c.bytes.push(row.bytes);
  }
  const byKind = Object.fromEntries(Object.entries(counts).map(([key,c]) => [key, { attempted:c.attempted, passed:c.passed, failed:c.failed, p50TtfbMs:quantile(c.ttfb,.5), p95TtfbMs:quantile(c.ttfb,.95), p95TotalMs:quantile(c.total,.95), p95HtmlBytes:quantile(c.bytes,.95) }]));
  const summary = { started, finished: new Date().toISOString(), origin: LOCAL, snapshotUrls: entries.length, attempted: rows.length, passed: rows.length-failed.length, failed:failed.length, untested:entries.length-rows.length, duplicateUrls, stopReason, transients, byKind, issues: failed.reduce((counts,row) => { for(const issue of row.issues) counts[issue]=(counts[issue]??0)+1; return counts; }, {}) };
  fs.writeFileSync(OUTPUT + "/summary.json", JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n## Full isolated sitemap audit\n\n" + "Attempted: " + summary.attempted + " / " + summary.snapshotUrls + "; passed: " + summary.passed + "; failed: " + summary.failed + "; untested: " + summary.untested + ".\n\n");
  if (stopReason || duplicateUrls.length || !rows.length || rows.length !== entries.length || failed.length) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
