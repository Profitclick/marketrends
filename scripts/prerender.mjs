// Build-time prerender of every ordinary-sitemap public route into dist/<route>/index.html.
// Read-only public (anon) reads; no AI, no writes. The React app boots normally over the static markup.
// Fails closed: any expected route failure or sitemap/prerender mismatch throws, which fails the build.
import fs from "node:fs";
import path from "node:path";
import { renderRoute, articlePage, listPage, hubPage, routeFile, parity, CATEGORIES, categorySlug } from "./prerender-lib.mjs";
import { dedupe, dedupeIntents } from "./sitemap-lib.mjs";
import { restFetch } from "./rest-fetch.mjs";

const PAGE = 500; // batched reads keep memory bounded per request

async function get(base, key, q) {
  return restFetch(`${base}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }, { label: q.split("?")[0] });
}
// Keyset pagination by id (offset paging on large rows times out); caller sorts deterministically.
async function getKeyset(base, key, q, size = 200) {
  const out = [];
  for (let last = null; ; ) {
    const b = await get(base, key, `${q}&order=id.asc&limit=${size}${last ? `&id=gt.${last}` : ""}`);
    out.push(...b); if (b.length < size) break; last = b[b.length - 1].id;
  }
  return out;
}
async function getAll(base, key, q) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const b = await restFetch(`${base}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + PAGE - 1}` } }, { label: q.split("?")[0] });
    out.push(...b); if (b.length < PAGE) break;
  }
  return out;
}

export async function prerender(outDir, base, key, io = fs) {
  if (!base || !key) throw new Error("missing public database configuration");
  const template = io.readFileSync(path.join(outDir, "index.html"), "utf8");
  const done = new Set(), failed = [];
  const write = (page) => {
    try {
      if (done.has(page.path)) throw new Error("duplicate route");
      const html = renderRoute(template, page);
      const file = routeFile(outDir, page.path);
      io.mkdirSync(path.dirname(file), { recursive: true });
      io.writeFileSync(file, html);
      done.add(page.path);
    } catch (e) { failed.push(`${page.path}: ${e.message}`); }
  };
  const pub = "published=eq.true";

  // Same eligibility as sitemap-articles-*.xml (published, deduped by slug); no count cap.
  const articles = dedupe((await getKeyset(base, key, `articles?select=id,slug,title,meta_description,content,category,image_url,source_name,source_url,created_at,updated_at,article_topics(topics(slug,name))&${pub}`)).sort((a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : a.id < b.id ? -1 : 1)));
  const latest = articles.slice(0, 40);
  const clusters = await get(base, key, "cluster_definitions?select=slug,name&order=slug");

  for (const c of clusters) {
    const rows = await get(base, key, `article_clusters?select=articles!inner(slug,title,published,created_at)&cluster_slug=eq.${c.slug}&articles.published=eq.true&order=created_at.desc&limit=30`);
    write(listPage({ path: `/${c.slug}`, title: `${c.name} – nyheter og analyse | Marketrends.no`, h1: c.name, crumbName: c.name,
      description: `Nyheter, analyse og forklaringer om ${c.name.toLowerCase()} for norske lesere.`, items: rows.map((r) => r.articles) }));
  }

  // Categories: same behaviour as CategoryPage (its own articles, otherwise latest as fallback).
  for (const [slug, info] of Object.entries(CATEGORIES)) {
    const own = articles.filter((a) => categorySlug(a.category) === slug).slice(0, 30);
    write(listPage({ path: `/kategori/${slug}`, title: `${info.name} - Norsk nyhetsportal | Marketrends.no`, h1: info.name, crumbName: info.name,
      description: info.description, items: own.length ? own : latest.slice(0, 30) }));
  }

  write(listPage({ path: "/om-oss", title: "Om oss | Marketrends.no", h1: "Om Marketrends.no", crumbName: "Om oss",
    description: "Uavhengig norsk publikasjon om finans, fintech, teknologi, AI, krypto og investering, med nyheter, analyse og forklaringer.", items: latest.slice(0, 10) }));
  write(listPage({ path: "/ressurser", title: "Ressurssenter – data, kilder og rapporter | Marketrends", h1: "Ressurser, data og kilder", crumbName: "Ressurser",
    description: "Et åpent bibliotek av kilder, datasett og rapporter som ligger til grunn for Marketrends sin dekning.", items: latest.slice(0, 10) }));

  // Public pages outside DB hubs (copy mirrors each React page's own title/H1).
  const STATIC = [
    ["/academy", "Markettrends Academy – Lær finans, AI og entreprenørskap", "Lær finans, AI og entreprenørskap", "Academy", "Norsk læringshub for finans, AI, SaaS, krypto og entreprenørskap. Strukturerte guider og kunnskapssider basert på dagsaktuelle nyheter."],
    ["/tools", "Verktøy – Kalkulatorer for finans, SaaS og startup", "Kalkulatorer og verktøy", "Verktøy", "Praktiske norske kalkulatorer for investering, SaaS-verdsettelse, runway, burn rate, AI ROI og mer. Bygget for grunnleggere og investorer."],
    ["/trending", "Trending nå – Hva beveger markedet i dag?", "Trending nå", "Trending", "Sanntidsoversikt over de mest leste artiklene, raskest voksende temaene og mest omtalte aktørene innen finans, krypto, AI og teknologi i Norge."],
    ["/newsletter", "Newsletter Center – temabaserte nyhetsbrev | Marketrends", "Nyhetsbrev", "Nyhetsbrev", "Meld deg på Marketrends sine temabaserte nyhetsbrev innen AI, krypto, fintech, startup, investering og trading."],
  ];
  for (const [p, title, h1, crumbName, description] of STATIC) write(listPage({ path: p, title, h1, crumbName, description, items: latest.slice(0, 10) }));
  // /ressurser/:type renders Resources, whose canonical is /ressurser; mirror that so the fallback never shows the homepage canonical.
  for (const t of ["research", "datasets", "sources", "statistics", "government", "industry"]) write(listPage({ path: `/ressurser/${t}`, canonicalPath: "/ressurser",
    title: "Ressurssenter – data, kilder og rapporter | Marketrends", h1: "Ressurser, data og kilder", crumbName: "Ressurser",
    description: "Et åpent bibliotek av kilder, datasett og rapporter som ligger til grunn for Marketrends sin dekning.", items: latest.slice(0, 10) }));
  const intents = dedupeIntents(await getAll(base, key, "search_intents?select=target_slug,keyword,meta,created_at&content_status=eq.published&target_slug=not.is.null&order=created_at.desc,target_slug.asc"));
  for (const i of intents) { const m = i.meta || {}; write(listPage({ path: `/intent/${i.target_slug}`, title: m.meta_title || m.title || i.keyword, h1: m.title || i.keyword, crumbName: m.title || i.keyword,
    description: m.meta_description || m.summary || i.keyword, items: latest.slice(0, 10) })); }

  const hubs = [
    ["topics", "/topic/", "Tema", "slug,name,description,meta_title,meta_description,created_at", "article_count=gt.0"],
    ["entities", "/entity/", "Aktør", "slug,name,description,summary,meta_title,meta_description,created_at", "mention_count=gt.0"],
    ["guides", "/guide/", "Guide", "slug,title,summary,content,meta_title,meta_description,created_at", pub],
    ["knowledge_pages", "/knowledge/", "Kunnskap", "slug,title,summary,content,meta_title,meta_description,created_at", pub],
    ["comparison_pages", "/compare/", "Sammenligning", "slug,title,summary,content,meta_title,meta_description,created_at", pub],
  ];
  for (const [table, prefix, label, sel, filter] of hubs) {
    const rows = dedupe(await getAll(base, key, `${table}?select=${sel}&${filter}&order=created_at.desc,slug.asc`));
    for (const row of rows) write(hubPage({ prefix, row, label, articles: latest.slice(0, 10) }));
  }

  const reserved = new Set([...clusters.map((c) => c.slug), "dashboard", "admin", "auth", "topic", "entity", "guide", "knowledge", "compare", "kategori", "cluster", "intent", "om-oss", "ressurser", "academy", "tools", "trending", "newsletter", "assets"]);
  for (const a of articles) {
    if (!a.slug || reserved.has(a.slug) || a.slug.includes("/")) { failed.push(`/${a.slug}: reserved or invalid slug`); continue; }
    write(articlePage(a));
  }

  // Homepage last so index.html stays the template until all routes are written.
  write(listPage({ path: "/", title: "Marketrends.no – nyheter om finans, fintech, krypto og AI",
    h1: "Marketrends.no – nyheter og analyse om finans og teknologi",
    description: "Uavhengig norsk publikasjon om finans, fintech, teknologi, AI, krypto og investering, med nyheter, analyse og forklaringer.",
    items: latest }));

  const p = parity(io, outDir, done);
  const result = { written: done.size, articles: articles.length, failed, ...p, missing: p.missing.length, unexpected: p.unexpected.length, missingList: p.missing.slice(0, 10), unexpectedList: p.unexpected.slice(0, 10) };
  if (failed.length) throw Object.assign(new Error(`prerender: ${failed.length} expected routes failed: ${failed.slice(0, 5).join("; ")}`), { result });
  if (p.missing.length) throw Object.assign(new Error(`prerender parity: ${p.missing.length} sitemap URLs without HTML: ${p.missing.slice(0, 5).join(", ")}`), { result });
  return result;
}
