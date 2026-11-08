// Build-time prerender of public routes into dist/<route>/index.html.
// Read-only public (anon) reads; no AI, no writes. The React app boots normally over the static markup.
import fs from "node:fs";
import path from "node:path";
import { renderRoute, articlePage, listPage, hubPage } from "./prerender-lib.mjs";

export const ARTICLE_LIMIT = 1000; // newest published articles per build; bounded for build cost

async function get(base, key, q) {
  const res = await fetch(`${base}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${q.split("?")[0]}: HTTP ${res.status}`);
  return res.json();
}
async function getAll(base, key, q, max) {
  const out = [];
  for (let from = 0; from < max; from += 1000) {
    const res = await fetch(`${base}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${Math.min(from + 999, max - 1)}` } });
    if (!res.ok) throw new Error(`${q.split("?")[0]}: HTTP ${res.status}`);
    const b = await res.json(); out.push(...b); if (b.length < 1000) break;
  }
  return out;
}

export async function prerender(outDir, base, key) {
  const template = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  const stats = { written: 0, failed: [] };
  const write = (page) => {
    try {
      const html = renderRoute(template, page);
      const file = page.path === "/" ? path.join(outDir, "index.html") : path.join(outDir, page.path.slice(1), "index.html");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, html);
      stats.written++;
    } catch (e) { stats.failed.push(`${page.path}: ${e.message}`); }
  };
  const pub = "published=eq.true";

  const articles = await getAll(base, key, `articles?select=slug,title,meta_description,content,category,image_url,source_name,source_url,created_at,updated_at,article_topics(topics(slug,name))&${pub}&created_at=lte.${new Date().toISOString()}&order=created_at.desc`, ARTICLE_LIMIT);
  const latest = articles.slice(0, 40);
  const clusters = await get(base, key, "cluster_definitions?select=slug,name&order=slug");

  // Routes that are not top-level article slugs are rendered first; articles never overwrite them.
  const reserved = new Set(["ai", "krypto", "fintech", "investering", "daytrading", "startup", "dashboard", "admin", "auth", "topic", "entity", "guide", "knowledge", "compare", "kategori", "cluster", "intent", "om-oss", "ressurser", "academy", "tools", "trending", "newsletter", "assets"]);

  for (const c of clusters) {
    const rows = await get(base, key, `article_clusters?select=score,articles!inner(slug,title,published,created_at)&cluster_slug=eq.${c.slug}&articles.published=eq.true&order=created_at.desc&limit=30`).catch(() => []);
    write(listPage({ path: `/${c.slug}`, title: `${c.name} – nyheter og analyse | Marketrends.no`, h1: c.name, crumbName: c.name,
      description: `Nyheter, analyse og forklaringer om ${c.name.toLowerCase()} for norske lesere.`, items: rows.map((r) => r.articles) }));
  }

  const hubs = [
    ["topics", "/topic/", "Tema", "slug,name,description,meta_title,meta_description", "article_count=gt.0"],
    ["entities", "/entity/", "Aktør", "slug,name,description,summary,meta_title,meta_description", "mention_count=gt.0"],
    ["guides", "/guide/", "Guide", `slug,title,summary,content,meta_title,meta_description`, pub],
    ["knowledge_pages", "/knowledge/", "Kunnskap", `slug,title,summary,content,meta_title,meta_description`, pub],
    ["comparison_pages", "/compare/", "Sammenligning", `slug,title,summary,content,meta_title,meta_description`, pub],
  ];
  for (const [table, prefix, label, sel, filter] of hubs) {
    const rows = await getAll(base, key, `${table}?select=${sel}&${filter}&order=slug`, 5000);
    for (const row of rows) write(hubPage({ prefix, row, label, articles: latest.slice(0, 10) }));
  }

  for (const a of articles) {
    if (!a.slug || reserved.has(a.slug) || a.slug.includes("/")) { stats.failed.push(`/${a.slug}: reserved or invalid slug`); continue; }
    write(articlePage(a));
  }

  // Homepage last so index.html stays the template until all routes are written.
  write(listPage({ path: "/", title: "Marketrends.no – nyheter om finans, fintech, krypto og AI",
    h1: "Marketrends.no – nyheter og analyse om finans og teknologi",
    description: "Uavhengig norsk publikasjon om finans, fintech, teknologi, AI, krypto og investering, med nyheter, analyse og forklaringer.",
    items: latest }));
  return { ...stats, articles: articles.length };
}
